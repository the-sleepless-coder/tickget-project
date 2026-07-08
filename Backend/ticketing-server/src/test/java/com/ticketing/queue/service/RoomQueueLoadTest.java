package com.ticketing.queue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.queue.domain.enums.QueueKeys;
import com.ticketing.queue.scheduler.RoomQueueConsumerScheduler;
import com.ticketing.seat.redis.MatchStatusRepository;
import io.lettuce.core.api.StatefulConnection;
import org.apache.commons.pool2.impl.GenericObjectPoolConfig;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettucePoolingClientConfiguration;
import org.springframework.data.redis.core.DefaultTypedTuple;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.kafka.core.KafkaTemplate;
import redis.embedded.RedisServer;

import java.lang.reflect.Field;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 도커 없이 RoomQueueConsumerRevised의 스레드 풀 동적 스케일링 + Redis 부하를 측정한다.
 *
 * 실행:
 *   ./gradlew test --tests "com.ticketing.queue.service.RoomQueueLoadTest"
 *
 * 파라미터(시스템 프로퍼티로 조절):
 *   -Drooms=20 -Dbots=50000 -Dusers=50 -DdurationSec=45 -Dredis.pool.maxActive=20
 *
 * 풀 병목 비교: maxActive를 20 → 100으로 바꿔 재실행하고 done/s, queue 백로그를 비교한다.
 */
public class RoomQueueLoadTest {

    @Test
    void measure() throws Exception {
        final int ROOMS       = Integer.getInteger("rooms", 20);
        final int BOTS        = Integer.getInteger("bots", 50_000);
        final int USERS       = Integer.getInteger("users", 50);
        final int DURATION    = Integer.getInteger("durationSec", 45);
        final int MAX_ACTIVE  = Integer.getInteger("redis.pool.maxActive", 20);
        final int PORT        = Integer.getInteger("redis.port", 16379);

        // 1) in-process Redis (도커 불필요)
        RedisServer redisServer = new RedisServer(PORT);
        redisServer.start();

        // 2) Lettuce 커넥션 풀 활성화 (commons-pool2 필요). shareNativeConnection=true(기본)
        //    → 일반 명령은 공유 커넥션 멀티플렉싱, executePipelined 는 풀에서 전용 커넥션 borrow.
        GenericObjectPoolConfig<StatefulConnection<?, ?>> pool = new GenericObjectPoolConfig<>();
        pool.setMaxTotal(MAX_ACTIVE);
        pool.setMaxIdle(MAX_ACTIVE);
        pool.setMinIdle(Math.min(5, MAX_ACTIVE));
        pool.setMaxWait(Duration.ofSeconds(3));

        LettucePoolingClientConfiguration clientCfg = LettucePoolingClientConfiguration.builder()
                .poolConfig(pool)
                .commandTimeout(Duration.ofSeconds(3))
                .build();

        LettuceConnectionFactory factory =
                new LettuceConnectionFactory(new RedisStandaloneConfiguration("localhost", PORT), clientCfg);
        factory.afterPropertiesSet();

        StringRedisTemplate redis = new StringRedisTemplate(factory);
        redis.afterPropertiesSet();

        // 3) Kafka 는 목 처리 (브로커 불필요)
        @SuppressWarnings("unchecked")
        KafkaTemplate<String, Object> kafka = Mockito.mock(KafkaTemplate.class);
        Mockito.when(kafka.send(Mockito.anyString(), Mockito.anyString(), Mockito.any()))
                .thenAnswer(inv -> CompletableFuture.completedFuture(null));

        MatchStatusRepository matchStatus = new MatchStatusRepository(redis);

        // 4) 대상 빈을 직접 생성 + @Value 설정값 주입
        RoomQueueConsumerScheduler consumer =
                new RoomQueueConsumerScheduler(redis, kafka, new ObjectMapper(), matchStatus);
        consumer.setConsumeRatePerSecond(100); // CONSUME_RATE_PER_2S
        consumer.setEmitMs(20);                // kafka-emit
        consumer.setCommitMs(2000);            // redis-emit

        // 5) 시드: 방마다 USERS명(양수) + BOTS개(음수)
        System.out.printf("seeding %d rooms x (%d users + %d bots)...%n", ROOMS, USERS, BOTS);
        long seedStart = System.currentTimeMillis();
        for (long matchId = 1; matchId <= ROOMS; matchId++) {
            redis.opsForValue().set("match:" + matchId + ":room", String.valueOf(1000 + matchId));
            matchStatus.setMatchStatus(matchId, "OPEN");
            seedQueue(redis, matchId, USERS, BOTS);
            consumer.registerRoom(matchId);
        }
        System.out.printf("seed done in %dms%n", System.currentTimeMillis() - seedStart);

        // 6) private roomExecutor 를 리플렉션으로 꺼내 모니터링
        Field f = RoomQueueConsumerScheduler.class.getDeclaredField("roomExecutor");
        f.setAccessible(true);
        ThreadPoolExecutor exec = (ThreadPoolExecutor) f.get(consumer);

        // 7) @Scheduled 대신 ticker 로 동일 주기 구동
        ScheduledExecutorService ticker = Executors.newScheduledThreadPool(6);
        ticker.scheduleAtFixedRate(consumer::crtThrdPublishDequeue,        0,   20,   TimeUnit.MILLISECONDS);
        ticker.scheduleAtFixedRate(consumer::crtThrdCommitDqdUsersRedis,   0,   2000, TimeUnit.MILLISECONDS);
        ticker.scheduleAtFixedRate(consumer::crtThrdUpdatePstsUsersRedis,  10,  2000, TimeUnit.MILLISECONDS);
        ticker.scheduleAtFixedRate(consumer::adjustThreadPool,             1000, 1000, TimeUnit.MILLISECONDS);

        // 8) 1초마다 풀 상태/처리량 출력
        AtomicLong lastDone = new AtomicLong(0);
        AtomicLong elapsed = new AtomicLong(0);
        System.out.printf("maxActive(pool)=%d, MIN/MAX thread=10/100%n", MAX_ACTIVE);
        System.out.println("t(s) | pool active queue | done/s");
        ticker.scheduleAtFixedRate(() -> {
            long done = exec.getCompletedTaskCount();
            long perSec = done - lastDone.getAndSet(done);
            System.out.printf("%4d | %4d %6d %5d | %6d%n",
                    elapsed.incrementAndGet(),
                    exec.getPoolSize(), exec.getActiveCount(), exec.getQueue().size(), perSec);
        }, 1000, 1000, TimeUnit.MILLISECONDS);

        // 9) 측정 시간 대기 후 정리
        Thread.sleep(DURATION * 1000L);

        // graceful 종료: 제출을 먼저 멈추고 진행 중 작업을 끝까지 기다린 뒤 닫는다.
        // (shutdownNow 로 인터럽트하면 Redis 명령 대기 중 워커가 예외 스택을 쏟아냄)
        ticker.shutdown();
        ticker.awaitTermination(3, TimeUnit.SECONDS);
        exec.shutdown();
        exec.awaitTermination(10, TimeUnit.SECONDS);
        factory.destroy();
        redisServer.stop();
    }

    /** ZSET 시드. 앞쪽(score 작음)=실유저(양수), 뒤쪽=봇(음수). 5000개씩 ZADD. */
    private void seedQueue(StringRedisTemplate redis, long matchId, int users, int bots) {
        ZSetOperations<String, String> zset = redis.opsForZSet();
        String key = "queue:" + matchId + ":waiting";
        int total = users + bots;
        int chunk = 5000;
        Set<ZSetOperations.TypedTuple<String>> buf = new HashSet<>(chunk * 2);
        Set<String> humans = new HashSet<>(users * 2);
        for (int i = 0; i < total; i++) {
            String member = (i < users)
                    ? String.valueOf(i + 1)             // 실유저: 1..users
                    : String.valueOf(-(i - users + 1)); // 봇: -1..-bots
            if (i < users) humans.add(member);
            buf.add(new DefaultTypedTuple<>(member, (double) i));
            if (buf.size() >= chunk) {
                zset.add(key, buf);
                buf.clear();
            }
        }
        if (!buf.isEmpty()) zset.add(key, buf);

        // 등수 갱신 대상(사람) SET 시드 — 운영 enqueue 와 동일하게
        if (!humans.isEmpty()) redis.opsForSet().add(QueueKeys.humansSet(matchId), humans.toArray(new String[0]));
    }
}
