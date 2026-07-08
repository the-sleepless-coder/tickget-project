package com.ticketing.queue.scheduler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.KafkaTopic;
import com.ticketing.queue.domain.enums.QueueKeys;
import com.ticketing.seat.redis.MatchStatusRepository;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.StringRedisConnection;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
@RequiredArgsConstructor
public class RoomQueueConsumerScheduler {
    private final StringRedisTemplate redis;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper mapper;
    private final MatchStatusRepository matchStatusRepository;

    private static final int MIN_THREADS = 10;
    private static final int MAX_THREADS = 100;
    private static final int TASKS_PER_THREAD_SCALE_UP = 5;
    private static final int TASKS_PER_THREAD_SCALE_DOWN = 2;
    private static final int SCALE_STEP = 30;

    // 전용 스레드 관련 코드를 따로 빼놓자 너무 헷갈려.
    private final Set<Long> activeRooms = ConcurrentHashMap.newKeySet();
    private final ThreadPoolExecutor roomExecutor = new ThreadPoolExecutor(
            MIN_THREADS, MAX_THREADS, 60L, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>()
    );

    public static int CONSUME_RATE_PER_2S;
    public static int EMIT_MS;
    public static int COMMIT_MS;

    @Value("${consume-rate.per-second}")
    public void setConsumeRatePerSecond(int v) { CONSUME_RATE_PER_2S = v; }

    @Value("${consume-rate.kafka-emit}")
    public void setEmitMs(int v) { EMIT_MS = v; }

    @Value("${consume-rate.redis-emit}")
    public void setCommitMs(int v) { COMMIT_MS = v; }

    private static final String STATE = "state";
    private static final String DEQUEUED = "DEQUEUED";
    private static final Duration STATE_TTL = Duration.ofSeconds(3);
    private static final int BATCH_SIZE = 1000;
    private static final int DELAY_DIFF = 10;

    public void registerRoom(Long matchId) {
        activeRooms.add(matchId);
        log.info("방 {} 대기열 처리 시작", matchId);
    }

    public void unregisterRoom(Long matchId) {
        activeRooms.remove(matchId);
        log.info("방 {} 대기열 처리 종료", matchId);
    }

    private static int getPerTick() {
        return Math.max(1, CONSUME_RATE_PER_2S * EMIT_MS / COMMIT_MS);
    }

    private long currentBucket() { return System.currentTimeMillis() / COMMIT_MS; }
    private long previousBucket() { return currentBucket() - 1; }
    private String bucketListKey(long matchId, long bucket) { return "q:" + matchId + ":bucket:" + bucket; }

    @Scheduled(fixedRate = 300_000) // 5분마다
    public void cleanupInactiveRooms() {
        for (Long matchId : activeRooms) {
            if (!matchStatusRepository.isOpen(matchId)) {
                activeRooms.remove(matchId);
                log.info("비활성 방 {} activeRooms에서 제거", matchId);
            }
        }
    }

    @Scheduled(fixedRate = 1000)
    public void adjustThreadPool() {
        int queueSize = roomExecutor.getQueue().size();
        int working = roomExecutor.getActiveCount();
        int poolsize = roomExecutor.getPoolSize();

        if (working == 0){ 
            if (poolsize > MIN_THREADS) {
                int newSize = Math.max(poolsize - SCALE_STEP, MIN_THREADS);
                roomExecutor.setCorePoolSize(newSize);
                roomExecutor.setMaximumPoolSize(newSize);
                log.info("스레드 풀 축소(유휴): {}→{}", poolsize, newSize);
            }
            return;
        }

        int ratio = queueSize / working;

        if (ratio > TASKS_PER_THREAD_SCALE_UP) {
            int newSize = Math.min(poolsize + SCALE_STEP, MAX_THREADS);
            roomExecutor.setMaximumPoolSize(newSize);
            roomExecutor.setCorePoolSize(newSize);
            log.info("스레드 풀 확장: {}→{} (큐:{}, 비율:{})", poolsize, newSize, queueSize, ratio);
        } else if (ratio < TASKS_PER_THREAD_SCALE_DOWN && poolsize > MIN_THREADS) {
            int newSize = Math.max(poolsize - SCALE_STEP, MIN_THREADS);
            roomExecutor.setCorePoolSize(newSize);
            roomExecutor.setMaximumPoolSize(newSize);
            log.info("스레드 풀 축소: {}→{} (큐:{}, 비율:{})", poolsize, newSize, queueSize, ratio);
        }
    }

    @Scheduled(fixedRateString = "${consume-rate.kafka-emit}")
    public void crtThrdPublishDequeue() {
        if (activeRooms.isEmpty()) return;
        for (Long matchId : activeRooms) {
            roomExecutor.submit(() -> publishDequeueForRoom(matchId));
        }
    }

    @Scheduled(fixedRateString = "${consume-rate.redis-emit}", initialDelay = 0)
    public void crtThrdCommitDqdUsersRedis() {
        if (activeRooms.isEmpty()) return;
        long bucket = previousBucket();
        for (Long matchId : activeRooms) {
            roomExecutor.submit(() -> commitDqdUsersRedisForRoom(matchId, bucket));
        }
    }

    @Scheduled(fixedRateString = "${consume-rate.redis-emit}", initialDelay = DELAY_DIFF)
    public void crtThrdUpdatePstsUsersRedis() {
        if (activeRooms.isEmpty()) return;
        for (Long matchId : activeRooms) {
            roomExecutor.submit(() -> updatePstsUsersRedisForRoom(matchId));
        }
    }

    private void publishDequeueForRoom(Long matchId) {
        long bucket = currentBucket(); // 실행 시점에 bucket 계산 (지연 실행 시 올바른 bucket에 기록)
        try {
            // 2초마다 400명, 즉 20ms 마다 각 방 별로 시간 순 대로 4명이 빠져나가게 한다.
            String zsetKey = "queue:" + matchId + ":waiting";
            ZSetOperations<String, String> zset = redis.opsForZSet();
            
            // 빠져나간 사용자를 ZSET에 시간 순으로 담는다.
            Set<ZSetOperations.TypedTuple<String>> popped = zset.popMin(zsetKey, getPerTick());
            if (popped == null || popped.isEmpty()) return;

            // 20ms마다 시간 순으로 먼저 온 사람들이 몇명 pop됐는지 확인한다.
            // 근데 이게 쓰여?

            redis.opsForValue().increment(QueueKeys.roomOffset(matchId), popped.size());
            
            // match Id: room 
            // 그러니까 matchId를 가져와서, 
            // 해당 매치에서 대기열을 빠져나간 사용자들을 업데이트 한다.
            String roomIdString = redis.opsForValue().get("match:" + matchId + ":room");
            if (roomIdString == null) {
                log.warn("roomIdString null. matchId={}", matchId);
                return;
            }
            Long roomIdLong = Long.valueOf(roomIdString);

            // ZSET에 포함된 사용자에 대해서 Kafka에 대기열을 빠져나갔다는 이벤트를 발행한다.
            for (ZSetOperations.TypedTuple<String> t : popped) {
                String userIdString = t.getValue();
                if (userIdString == null) continue;

                Long userIdLong = Long.valueOf(userIdString);

                // Kafka에 발행할 Payload 형성.
                Map<String, Object> payload = Map.of(
                        "roomId", roomIdLong,
                        "matchId", matchId,
                        "userId", userIdLong,
                        "ts", System.currentTimeMillis()
                );

                // 사용자에 대한 이벤트만 발행.
                // 봇에 대한 이벤트는 발행하지 않는다.
                String topic = userIdLong > 0
                        ? KafkaTopic.USER_DEQUEUED.getTopicName()
                        : KafkaTopic.BOT_DEQUEUED.getTopicName();

                kafkaTemplate.send(topic, userIdString, payload)
                        .whenComplete((result, ex) -> {
                            if (ex != null) {
                                log.error("Kafka 발행 실패: topic={} key={}", topic, userIdString, ex);
                                zset.add(zsetKey, userIdString, (double) System.currentTimeMillis());
                            }
                        });

                // 빠져나간 사람은 humans SET 에서도 제거 (등수 갱신 대상에서 제외)
                if (userIdLong > 0) {
                    redis.opsForSet().remove(QueueKeys.humansSet(matchId), userIdString);
                }

                // 20ms 마다 삐져나간 사용자들을 2초 단위의 bucket 키에 모은다.
                // 2000ms 마다 빠져나간 사용자들에 대한 정보를,
                // 일괄적으로 Redis ZSET, HASH 자료구조에 저장한다.
                redis.opsForList().rightPush(bucketListKey(matchId, bucket), userIdString);
            }
        } catch (Exception e) {
            log.error("publishDequeue 오류: matchId={}", matchId, e);
        }
    }

    // Redis에서 사용자의 dequeue상태를 HASH 자료구조에 업데이트.
    private void commitDqdUsersRedisForRoom(Long matchId, long bucket)
    {
        try {
            // 2초 단위로 묶여진 bucket에 대한 키를 가져오고,
            // 사용자의 상태를 dequeued로 바꿔준다.
            String listKey = bucketListKey(matchId, bucket);
            Long count = redis.opsForList().size(listKey);
            if (count == null || count == 0) return;

            redis.executePipelined((RedisCallback<Object>) connection -> {
                // 사용자의 dequeueud 상태를 HASH 자료구조에 업데이트.
                for (int i = 0; i < count; i++) {
                    String userId = redis.opsForList().leftPop(listKey);
                    if (userId == null) continue;
                    Long userIdLong = Long.valueOf(userId);

                    if (userIdLong > 0) {
                        String userStateKey = QueueKeys.userStateKey(matchId, userId);
                        connection.hSet(userStateKey.getBytes(), STATE.getBytes(), DEQUEUED.getBytes());
                        connection.expire(userStateKey.getBytes(), STATE_TTL.getSeconds());
                    }
                }

                Long tot = redis.opsForZSet().zCard("queue:" + matchId + ":waiting");
                String totalKey = QueueKeys.roomTotal(matchId);
                connection.set(totalKey.getBytes(), String.valueOf(tot == null ? 0 : tot).getBytes());

                return null;
            });

            redis.delete(listKey);
        } catch (Exception e) {
            log.error("commitDqdUsersRedis 오류: matchId={}", matchId, e);
        }
    }

    // Redis에서 사용자의 등수를 HASH 자료구조에 업데이트.
    // 전체 ZSET(봇 포함 수만 명)을 스캔하지 않고, 사람(humans SET, 보통 ≤50명)만
    // ZRANK 로 위치를 조회한다. 봇이 아무리 많아도 부하는 사람 수에만 비례한다.
    private void updatePstsUsersRedisForRoom(Long matchId) {
        try {
            String zkey = "queue:" + matchId + ":waiting";
            ZSetOperations<String, String> zset = redis.opsForZSet();

            Long totalL = zset.zCard(zkey);
            long total = (totalL == null) ? 0L : totalL;
            if (total == 0) return;

            // 등수 갱신 대상은 사람뿐. 봇은 애초에 이 SET 에 없다.
            Set<String> humans = redis.opsForSet().members(QueueKeys.humansSet(matchId));
            if (humans == null || humans.isEmpty()) return;

            long now = System.currentTimeMillis();

            // 1) 사람별 rank 조회 (ZRANK: O(log N), 전체 순회 없음)
            //    파이프라인 콜백 안에서는 결과를 즉시 못 쓰므로, 읽기는 먼저 수행한다.
            Map<String, Long> ranks = new HashMap<>(humans.size() * 2);
            for (String userId : humans) {
                Long r = zset.rank(zkey, userId);
                if (r != null) ranks.put(userId, r); // null = 이미 대기열을 빠져나감
            }
            if (ranks.isEmpty()) return;

            // 2) 조회 결과를 파이프라인으로 일괄 기록
            redis.executePipelined((RedisCallback<Object>) conn -> {
                StringRedisConnection c = (StringRedisConnection) conn;
                for (Map.Entry<String, Long> e : ranks.entrySet()) {
                    long rank = e.getValue();

                    Map<String, String> m = new HashMap<>(4);
                    m.put("ahead",       Long.toString(rank));
                    m.put("behind",      Long.toString(total - 1 - rank));
                    m.put("total",       Long.toString(total));
                    m.put("lastUpdated", Long.toString(now));

                    String hkey = QueueKeys.userStateKey(matchId, e.getKey());
                    c.hMSet(hkey, m);
                    c.expire(hkey, 1800);
                }
                return null;
            });
        } catch (Exception e) {
            log.error("updatePstsUsersRedis 오류: matchId={}", matchId, e);
        }
    }

    @PreDestroy
    public void shutdown() {
        roomExecutor.shutdownNow();
    }
}
