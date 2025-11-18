package com.ticketing.queue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.KafkaTopic;
import com.ticketing.queue.domain.enums.QueueKeys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

@Service
@Slf4j
@RequiredArgsConstructor
public class QueueConsumer {
    private final StringRedisTemplate redis;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper mapper;

    // 주기 설정
    private static final int CONSUME_RATE_PER_2S = 10;  // 2초당 최대 소비자 수
    private static final int EMIT_MS = 1_500;             // Kafka 발행 틱 (20ms)
    private static final int COMMIT_MS = 1_000;          // Redis 상태 커밋 주기 (2s)

    private static final String STATE = "state";
    private static final String DEQUEUED = "DEQUEUED";
    private static final Duration STATE_TTL = Duration.ofSeconds(3);

    // 틱당 소비량 = 2초 총량을 틱 수로 나눔 (200 / (2000/20) = 2)
    private static final int PER_TICK = Math.max(1, CONSUME_RATE_PER_2S * EMIT_MS / COMMIT_MS);

    // 대규모 방 대비 배치 사이즈
    private static final int BATCH_SIZE = 1000;

    private static final int DELAY_DIFF = 10;

    // 윈도우 버킷 계산
    // Kafka 발행 주기를 기준으로 Bucket단위로 묶어서, 각 Bucket당 처리된 메시지를 Redis에 묶어서 key값을 저장한다.
    private long currentBucket() {
        return System.currentTimeMillis() / COMMIT_MS;
    }
    private long previousBucket() {
        return currentBucket() - 1;
    }

    // 윈도우 리스트 키
    private String windowListKey(long matchId, long bucket) {
        return "q:" + matchId + ":window:" + bucket;
    }

    @Scheduled(fixedRate = EMIT_MS) // 빠른 주기: 카프카 발행
    public void emitTick() {
        ZSetOperations<String, String> zset = redis.opsForZSet();
        Set<String> roomKeys = redis.keys("queue:*:waiting");
        if (roomKeys == null || roomKeys.isEmpty()) return;

        long bucket = currentBucket();

        for (String zsetKey : roomKeys) {
            // "queue:{matchId}:waiting" → matchId
            String matchIdStr = zsetKey.replace("queue:", "").replace(":waiting", "");
            long matchId;
            try { matchId = Long.parseLong(matchIdStr); } catch (Exception e) { continue; }

            // 이번 틱에서 뺄 개수
            Set<ZSetOperations.TypedTuple<String>> popped = zset.popMin(zsetKey, PER_TICK);
            if (popped == null || popped.isEmpty()) continue;

            // 방별 통계 갱신을 위해 카운트 누적 (2초 커밋 때 반영)
            redis.opsForValue().increment(QueueKeys.roomOffset(matchId), popped.size());

            for (ZSetOperations.TypedTuple<String> t : popped) {
                String userIdString = t.getValue();
                if (userIdString == null) continue;

                String roomIdString = redis.opsForValue().get("match:" + matchId + ":room");
                if (roomIdString == null) {
                    log.warn("⚠️ roomIdString이 null입니다. matchId={}", matchId);
                    continue;
                }
                Long roomIdLong = Long.valueOf(roomIdString);
                Long userIdLong = Long.valueOf(userIdString);
                // 1) 카프카 즉시 발행 (Kafka의 batch/linger가 자연스런 배칭 담당)
                Map<String, Object> payload = Map.of(
                        "roomId", roomIdLong,
                        "matchId", matchId,
                        "userId", userIdLong,
                        "ts", System.currentTimeMillis()
                );
                try {
                    // 사용자일 경우 보내는 대기열을 빠져나갔다는 Kafka 이벤트 발행
                    if(userIdLong>0){
                        kafkaTemplate.send(
                                        KafkaTopic.USER_DEQUEUED.getTopicName(),
                                        userIdString, // key: userId → 파티션 분산/순서 보장 용도
                                        payload // JSON 형태 그대로, 직렬화할 필요 없음.
                                )
                                .whenComplete( (result, ex) -> {
                                    if (ex != null || result == null) {
                                        log.error("❌ Kafka 발행 실패: topic={} key={}", KafkaTopic.USER_DEQUEUED.getTopicName(), userIdString, ex);
                                    }
                                /**
                                else{
                                    log.info("KAFKA roomId{}, matchId:{}, userId{} 사용자가 정상적으로 빠져나갔습니다.",roomIdLong, matchId, userIdLong);
                                }
                                 */
                                });
                    }
                    // 봇일 경우 보내는 대기열을 빠져나갔다는 Kafka 이벤트 발행
                    else if(userIdLong<0){
                        kafkaTemplate.send(
                                KafkaTopic.BOT_DEQUEUED.getTopicName(),
                                userIdString, // key: userId → 파티션 분산/순서 보장 용도
                                payload // JSON 형태 그대로, 직렬화할 필요 없음.
                        ).whenComplete( (result, ex) -> {
                            if (ex != null || result == null) {
                                log.error("❌ Kafka 발행 실패: topic={} key={}", KafkaTopic.USER_DEQUEUED.getTopicName(), userIdString, ex);
                            }/*else{
                                    log.info(" roomId{}, matchId:{}, userId{} 봇이 정상적으로 빠져나갔습니다.",roomIdLong, matchId, userIdLong);
                                }*/
                        });
                    }


                } catch (Exception e) {
                    // 실패 시: 재시도 정책/보상 트랜잭션은 설계에 따라
                    // 간단 복구: 다시 대기열로 밀어 넣기 (score는 지금 시각)
                    zset.add(zsetKey, userIdString, (double) System.currentTimeMillis());
                    continue;
                }

                // 2) 이번 윈도우 버킷에 커밋 대기표시(사용자 목록 적재)
                //    2초 커밋 시점에만 실제 state=DEQUEUED, TTL부여
                redis.opsForList().rightPush(windowListKey(matchId, bucket), userIdString);
            }

            // 잔여 대기열 크기 기록은 2초 커밋 시점에서 한번에 맞추는 것을 권장
        }
    }

    // 2초마다 사용자에 대한 Redis 키 업데이트
    @Scheduled(fixedRate = COMMIT_MS, initialDelay = 0) // 2초마다 커밋
    public void commitWindow() {
        long bucket = previousBucket(); // 직전 윈도우를 커밋
        // 방 키를 한 번 더 긁어, 각 방의 버킷리스트를 처리
        Set<String> roomKeys = redis.keys("queue:*:waiting");
        if (roomKeys == null || roomKeys.isEmpty()) return;

        for (String zsetKey : roomKeys) {
            String matchIdStr = zsetKey.replace("queue:", "").replace(":waiting", "");
            long matchId;
            try { matchId = Long.parseLong(matchIdStr); } catch (Exception e) { continue; }

            String listKey = windowListKey(matchId, bucket);
            Long count = redis.opsForList().size(listKey);
            if (count == null || count == 0) continue;

            // 파이프라인으로 상태/TTL/통계 갱신을 일괄 처리
            redis.executePipelined((RedisCallback<Object>) connection -> {
                for (int i = 0; i < count; i++) {
                    String userId = redis.opsForList().leftPop(listKey);
                    if (userId == null) continue;
                    Long userIdLong = Long.valueOf(userId);

                    if(userIdLong>0){
                        String userStateKey = QueueKeys.userStateKey(matchId, userId);
                        // HSET state=DEQUEUED
                        connection.hSet(userStateKey.getBytes(), STATE.getBytes(), DEQUEUED.getBytes());
                        // EXPIRE 3s
                        connection.expire(userStateKey.getBytes(), STATE_TTL.getSeconds());
                    }

                }

                // 방 전체 잔량도 이 타이밍에 스냅샷
                Long tot = redis.opsForZSet().zCard("queue:" + matchId + ":waiting");
                String totalKey = QueueKeys.roomTotal(matchId);
                connection.set(totalKey.getBytes(), String.valueOf(tot == null ? 0 : tot).getBytes());

                return null;
            });

            // 윈도우 리스트 정리
            redis.delete(listKey);
        }
    }

    // 2초마다 사용자에 대한 Redis 키 업데이트
    @Scheduled(fixedRate = COMMIT_MS, initialDelay = DELAY_DIFF)
    public void updatePositions() {
        ZSetOperations<String, String> zset = redis.opsForZSet();
        Set<String> roomKeys = redis.keys("queue:*:waiting");
        if (roomKeys == null || roomKeys.isEmpty()) return;

        long now = System.currentTimeMillis();

        for (String zkey : roomKeys) {
            String matchIdStr = zkey.replace("queue:", "").replace(":waiting", "");
            long matchId;
            try { matchId = Long.parseLong(matchIdStr); } catch (Exception e) { continue; }

            Long totalL = zset.zCard(zkey);
            long total = (totalL == null) ? 0L : totalL;
            if (total == 0) continue;

            // 전체 범위를 배치로 순회
            for (long start = 0; start < total; start += BATCH_SIZE) {
                long end = Math.min(start + BATCH_SIZE - 1, total - 1);
                Set<String> members = zset.range(zkey, start, end);
                if (members == null || members.isEmpty()) continue;

                final long baseRank = start;

                redis.executePipelined((RedisCallback<Object>) conn -> {
                    StringRedisConnection c = (StringRedisConnection) conn;
                    int idx = 0;

                    for (String userId : members) {
                        long rank   = baseRank + idx;
                        long ahead  = rank;
                        long behind = total - 1 - rank;

                        // --- 봇 스킵 로직 ---
                        // 1) userId 부호로 구분(숫자라면 가장 빠름)
                        boolean isBot = false;
                        try {
                            long uid = Long.parseLong(userId);
                            if (uid < 0) isBot = true;
                        } catch (NumberFormatException ignore) {
                            // 숫자가 아니라면 playerType 필드로 판단할 수도 있음(필요 시 두 단계 파이프라인 구성)
                        }
                        if (isBot) {
                            idx++; continue;
                        }

                        String hkey = QueueKeys.userStateKey(matchId, userId);

                        Map<String, String> m = new HashMap<>(4);
                        m.put("ahead",       Long.toString(ahead));
                        m.put("behind",      Long.toString(behind));
                        m.put("total",       Long.toString(total));
                        m.put("lastUpdated", Long.toString(now));

                        // 네가 주었던 그대로: HMSET + (선택) TTL
                        c.hMSet(hkey, m);
                        c.expire(hkey, 1800);

                        idx++;
                    }
                    return null;
                });
            }
        }
    }



}
