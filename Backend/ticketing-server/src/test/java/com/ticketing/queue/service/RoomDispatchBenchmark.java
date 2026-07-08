package com.ticketing.queue.service;

import com.ticketing.queue.domain.enums.QueueKeys;
import io.lettuce.core.api.StatefulConnection;
import org.apache.commons.pool2.impl.GenericObjectPoolConfig;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.StringRedisConnection;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettucePoolingClientConfiguration;
import org.springframework.data.redis.core.DefaultTypedTuple;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import redis.embedded.RedisServer;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * 방별 작업을 "순차(한 스레드 for문)" vs "병렬(스레드풀)"로 처리할 때의 전체 시간 비교.
 * 작업 내용은 동일(현 ZRANK 등수 갱신) — 디스패치 방식만 다르게 한다.
 *
 *   ./gradlew test --tests "com.ticketing.queue.service.RoomDispatchBenchmark"
 */
public class RoomDispatchBenchmark {

    static final int USERS = 50;      // 방당 사람
    static final int BOTS  = 5000;    // 방당 봇 (ZRANK 대상 집합 크기 확보용)
    static final int WARMUP = 5;
    static final int ITER  = 30;
    static final int PORT  = 16399;

    @Test
    void compare() throws Exception {
        RedisServer redisServer = new RedisServer(PORT);
        redisServer.start();

        GenericObjectPoolConfig<StatefulConnection<?, ?>> pool = new GenericObjectPoolConfig<>();
        pool.setMaxTotal(128);
        pool.setMaxIdle(128);
        pool.setMinIdle(16);
        pool.setMaxWait(Duration.ofSeconds(5));

        LettuceConnectionFactory factory = new LettuceConnectionFactory(
                new RedisStandaloneConfiguration("localhost", PORT),
                LettucePoolingClientConfiguration.builder()
                        .poolConfig(pool).commandTimeout(Duration.ofSeconds(5)).build());
        factory.afterPropertiesSet();
        StringRedisTemplate redis = new StringRedisTemplate(factory);
        redis.afterPropertiesSet();

        System.out.printf("작업: 방별 ZRANK 등수 갱신 (사람 %d, 봇 %d). 단위 ms = 전체 방 1회 처리 시간%n", USERS, BOTS);
        System.out.println("rooms | 순차(for문) | 병렬(풀) | 속도향상");

        for (int rooms : new int[]{20, 100}) {
            List<Long> ids = seed(redis, rooms);
            ExecutorService poolExec = Executors.newFixedThreadPool(rooms); // 방마다 1스레드(완전 병렬)

            // 워밍업 (JIT / 커넥션 풀)
            for (int i = 0; i < WARMUP; i++) { runSequential(redis, ids); runParallel(redis, ids, poolExec); }

            double seq = 0, par = 0;
            for (int i = 0; i < ITER; i++) seq += runSequential(redis, ids);
            for (int i = 0; i < ITER; i++) par += runParallel(redis, ids, poolExec);
            seq /= ITER; par /= ITER;

            System.out.printf("%5d | %9.1f | %7.1f | %.1fx%n", rooms, seq, par, seq / par);

            poolExec.shutdownNow();
            cleanup(redis, ids);
        }

        factory.destroy();
        redisServer.stop();
    }

    /** 방 수(20/50/100)별로, 스레드 수만 1→64 로 바꿔가며 속도향상이 어디서 평평해지는지 본다. */
    @Test
    void threadSweep() throws Exception {
        int port = 16400, warmup = 3, iter = 12;
        RedisServer redisServer = new RedisServer(port);
        redisServer.start();
        LettuceConnectionFactory factory = buildFactory(port);
        StringRedisTemplate redis = new StringRedisTemplate(factory);
        redis.afterPropertiesSet();

        StringBuilder rep = new StringBuilder();
        String EQ = "=".repeat(52);
        String DASH = "-".repeat(52);

        // ===== [1] 순차(for문) vs 병렬(완전 병렬 풀) — 전체 방 1회 처리 =====
        emit(rep, EQ);
        emit(rep, "  [1] 순차(for문) vs 병렬(스레드풀) 전체 처리 시간");
        emit(rep, EQ);
        emit(rep, String.format("  %-6s |  %-11s |  %-11s |  %s", "방 수", "순차 (ms)", "병렬 (ms)", "속도향상"));
        emit(rep, DASH);
        for (int rooms : new int[]{20, 100}) {
            List<Long> ids = seed(redis, rooms);
            ExecutorService ex = Executors.newFixedThreadPool(rooms); // 방마다 1스레드(완전 병렬)
            for (int i = 0; i < warmup; i++) { runSequential(redis, ids); runParallel(redis, ids, ex); }
            double seq = 0, par = 0;
            for (int i = 0; i < iter; i++) seq += runSequential(redis, ids);
            for (int i = 0; i < iter; i++) par += runParallel(redis, ids, ex);
            seq /= iter; par /= iter;
            emit(rep, String.format("  %4d   |  %9.1f   |  %9.1f   |  %5.2f x", rooms, seq, par, seq / par));
            ex.shutdownNow();
            cleanup(redis, ids);
        }

        // ===== [2] 방 수별 스레드 수 스윕 — 포화점 확인 =====
        for (int rooms : new int[]{20, 50, 100}) {
            List<Long> ids = seed(redis, rooms);

            for (int i = 0; i < warmup; i++) runSequential(redis, ids);
            double seq = 0; for (int i = 0; i < iter; i++) seq += runSequential(redis, ids); seq /= iter;

            emit(rep, "");
            emit(rep, EQ);
            emit(rep, String.format("  방 %d개   |  기준 순차(1스레드 for문) = %.1f ms", rooms, seq));
            emit(rep, EQ);
            emit(rep, String.format("  %-8s |  %-12s |  %s", "스레드", "병렬 (ms)", "속도향상"));
            emit(rep, DASH);
            for (int t : new int[]{1, 2, 3, 4, 8, 16, 32, 64}) {
                ExecutorService ex = Executors.newFixedThreadPool(t);
                for (int i = 0; i < warmup; i++) runParallel(redis, ids, ex);
                double par = 0; for (int i = 0; i < iter; i++) par += runParallel(redis, ids, ex); par /= iter;
                emit(rep, String.format("  %6d   |  %10.1f   |  %5.2f x", t, par, seq / par));
                ex.shutdownNow();
            }
            emit(rep, EQ);
            cleanup(redis, ids);
        }

        java.nio.file.Path outFile = java.nio.file.Paths.get("dispatch-benchmark.txt").toAbsolutePath();
        java.nio.file.Files.writeString(outFile, rep.toString(), java.nio.charset.StandardCharsets.UTF_8);
        System.out.println("\n>> 결과 파일(UTF-8, VSCode 에서 열기): " + outFile);

        factory.destroy();
        redisServer.stop();
    }

    /** 터미널 캡쳐용: 스레드(행) x 방 개수(열) 속도향상 한 표를 ASCII 로 출력 → 안 깨짐. */
    @Test
    void crossTab() throws Exception {
        int port = 16401, warmup = 5, iter = 25;
        RedisServer redisServer = new RedisServer(port);
        redisServer.start();
        LettuceConnectionFactory factory = buildFactory(port);
        StringRedisTemplate redis = new StringRedisTemplate(factory);
        redis.afterPropertiesSet();

        int[] threadsArr = {1, 2, 4, 8, 16, 32, 64, 100, 128};
        int[] roomsArr   = {20, 50, 100, 150, 200};
        double[]   seqMs = new double[roomsArr.length];
        double[][] parMs = new double[threadsArr.length][roomsArr.length];
        double[][] sp    = new double[threadsArr.length][roomsArr.length];

        for (int r = 0; r < roomsArr.length; r++) {
            List<Long> ids = seed(redis, roomsArr[r]);

            // (1) seq/par 양쪽을 충분히 데움 → cold-bias 제거
            ExecutorService warm = Executors.newFixedThreadPool(16);
            for (int i = 0; i < warmup; i++) { runSequential(redis, ids); runParallel(redis, ids, warm); }
            warm.shutdownNow();

            // (2) 순차 기준값을 warm 상태에서 median 으로 측정
            double[] seqS = new double[iter];
            for (int i = 0; i < iter; i++) seqS[i] = runSequential(redis, ids);
            double seq = median(seqS);
            seqMs[r] = seq;

            // (3) 각 스레드 수의 병렬도 median 으로 측정
            for (int ti = 0; ti < threadsArr.length; ti++) {
                ExecutorService ex = Executors.newFixedThreadPool(threadsArr[ti]);
                for (int i = 0; i < warmup; i++) runParallel(redis, ids, ex);
                double[] parS = new double[iter];
                for (int i = 0; i < iter; i++) parS[i] = runParallel(redis, ids, ex);
                double par = median(parS);
                parMs[ti][r] = par;
                sp[ti][r] = seq / par;
                ex.shutdownNow();
            }
            cleanup(redis, ids);
        }

        // (1) cross-tab: speedup only  [rows = threads, cols = rooms]  — 컬럼은 roomsArr 따라 자동
        System.out.println();
        System.out.println(" Speedup (x)   [rows = threads, cols = rooms]");
        StringBuilder hdr = new StringBuilder(" threads");
        StringBuilder sep = new StringBuilder(" --------");
        for (int rm : roomsArr) { hdr.append(String.format(" | %4d rms", rm)); sep.append("+----------"); }
        System.out.println(hdr);
        System.out.println(sep);
        for (int ti = 0; ti < threadsArr.length; ti++) {
            StringBuilder row = new StringBuilder(String.format(" %7d", threadsArr[ti]));
            for (int r = 0; r < roomsArr.length; r++) row.append(String.format(" | %7.2fx", sp[ti][r]));
            System.out.println(row);
        }

        // (2) per-room detail (parallel ms / speedup / ms-per-room)
        for (int r = 0; r < roomsArr.length; r++) {
            System.out.println();
            System.out.println("=========================================================");
            System.out.printf( " ROOMS = %-4d | sequential(1-thread for-loop) = %.1f ms%n", roomsArr[r], seqMs[r]);
            System.out.println("=========================================================");
            System.out.println(" threads | parallel(ms) | speedup | ms/room");
            System.out.println(" --------+--------------+---------+--------");
            for (int ti = 0; ti < threadsArr.length; ti++) {
                System.out.printf(" %7d | %12.1f | %6.2fx | %7.2f%n",
                        threadsArr[ti], parMs[ti][r], sp[ti][r], parMs[ti][r] / roomsArr[r]);
            }
            System.out.println("=========================================================");
        }

        factory.destroy();
        redisServer.stop();
    }

    /** 옛날(전체 ZSET 스캔) vs 지금(사람만 ZRANK) — 한 방, 사람 50 + 봇 50,000 기준 */
    @Test
    void scanVsZrank() throws Exception {
        int port = 16402, warmup = 5, iter = 25, users = 50, bots = 50_000;
        RedisServer redisServer = new RedisServer(port);
        redisServer.start();
        LettuceConnectionFactory factory = buildFactory(port);
        StringRedisTemplate redis = new StringRedisTemplate(factory);
        redis.afterPropertiesSet();

        long matchId = 1;
        seedOneRoom(redis, matchId, users, bots);

        for (int i = 0; i < warmup; i++) { oldScan(redis, matchId); positionWork(redis, matchId); }

        double[] s = new double[iter];
        for (int i = 0; i < iter; i++) { long t0 = System.nanoTime(); oldScan(redis, matchId);      s[i] = (System.nanoTime() - t0) / 1e6; }
        double[] z = new double[iter];
        for (int i = 0; i < iter; i++) { long t0 = System.nanoTime(); positionWork(redis, matchId); z[i] = (System.nanoTime() - t0) / 1e6; }
        double scan = median(s), zr = median(z);

        System.out.println();
        System.out.println("=================================================");
        System.out.printf(  " 1 room | humans = %d | bots = %d%n", users, bots);
        System.out.println("=================================================");
        System.out.println(" method                | median(ms) | speedup");
        System.out.println(" ----------------------+------------+--------");
        System.out.printf(  " OLD (full ZSET scan)  | %10.2f | %6s%n", scan, "1.0x");
        System.out.printf(  " NEW (humans + ZRANK)  | %10.2f | %5.1fx%n", zr, scan / zr);
        System.out.println("=================================================");

        redis.delete("queue:" + matchId + ":waiting");
        redis.delete(com.ticketing.queue.domain.enums.QueueKeys.humansSet(matchId));
        factory.destroy();
        redisServer.stop();
    }

    /** 옛날 방식: 전체 ZSET 을 1000개씩 ZRANGE 로 훑고 봇은 건너뛰며 사람만 기록 */
    private void oldScan(StringRedisTemplate redis, long matchId) {
        String zkey = "queue:" + matchId + ":waiting";
        ZSetOperations<String, String> zset = redis.opsForZSet();
        Long totalL = zset.zCard(zkey);
        long total = (totalL == null) ? 0L : totalL;
        if (total == 0) return;
        long now = System.currentTimeMillis();
        for (long start = 0; start < total; start += 1000) {
            long end = Math.min(start + 999, total - 1);
            Set<String> members = zset.range(zkey, start, end);
            if (members == null || members.isEmpty()) continue;
            final long baseRank = start;
            redis.executePipelined((RedisCallback<Object>) conn -> {
                StringRedisConnection c = (StringRedisConnection) conn;
                int idx = 0;
                for (String userId : members) {
                    try { if (Long.parseLong(userId) < 0) { idx++; continue; } } catch (NumberFormatException ignore) {}
                    long rank = baseRank + idx;
                    Map<String, String> m = new HashMap<>(4);
                    m.put("ahead", Long.toString(rank));
                    m.put("behind", Long.toString(total - 1 - rank));
                    m.put("total", Long.toString(total));
                    m.put("lastUpdated", Long.toString(now));
                    String hkey = com.ticketing.queue.domain.enums.QueueKeys.userStateKey(matchId, userId);
                    c.hMSet(hkey, m);
                    c.expire(hkey, 1800);
                    idx++;
                }
                return null;
            });
        }
    }

    private void seedOneRoom(StringRedisTemplate redis, long matchId, int users, int bots) {
        ZSetOperations<String, String> zset = redis.opsForZSet();
        String key = "queue:" + matchId + ":waiting";
        int total = users + bots, chunk = 5000;
        Set<ZSetOperations.TypedTuple<String>> buf = new HashSet<>(chunk * 2);
        Set<String> humans = new HashSet<>(users * 2);
        for (int i = 0; i < total; i++) {
            String member = (i < users) ? String.valueOf(i + 1) : String.valueOf(-(i - users + 1));
            if (i < users) humans.add(member);
            buf.add(new DefaultTypedTuple<>(member, (double) i));
            if (buf.size() >= chunk) { zset.add(key, buf); buf.clear(); }
        }
        if (!buf.isEmpty()) zset.add(key, buf);
        redis.opsForSet().add(com.ticketing.queue.domain.enums.QueueKeys.humansSet(matchId), humans.toArray(new String[0]));
    }

    /** outlier(GC 등)에 강한 중앙값 */
    private static double median(double[] a) {
        double[] c = a.clone();
        java.util.Arrays.sort(c);
        int n = c.length;
        return (n % 2 == 1) ? c[n / 2] : (c[n / 2 - 1] + c[n / 2]) / 2.0;
    }

    /** 콘솔 + 리포트 버퍼에 동시 출력 (파일은 UTF-8 이라 한글 안 깨짐) */
    private static void emit(StringBuilder sb, String line) {
        System.out.println(line);
        sb.append(line).append(System.lineSeparator());
    }

    private LettuceConnectionFactory buildFactory(int port) {
        GenericObjectPoolConfig<StatefulConnection<?, ?>> pool = new GenericObjectPoolConfig<>();
        pool.setMaxTotal(128); pool.setMaxIdle(128); pool.setMinIdle(16); pool.setMaxWait(Duration.ofSeconds(5));
        LettuceConnectionFactory f = new LettuceConnectionFactory(
                new RedisStandaloneConfiguration("localhost", port),
                LettucePoolingClientConfiguration.builder()
                        .poolConfig(pool).commandTimeout(Duration.ofSeconds(5)).build());
        f.afterPropertiesSet();
        return f;
    }

    /** 한 스레드에서 모든 방을 for문으로 순차 처리 → 전체 ms */
    private double runSequential(StringRedisTemplate redis, List<Long> ids) {
        long t0 = System.nanoTime();
        for (Long m : ids) positionWork(redis, m);
        return (System.nanoTime() - t0) / 1_000_000.0;
    }

    /** 스레드풀에 방마다 submit → 모두 끝날 때까지 대기 → 전체 ms */
    private double runParallel(StringRedisTemplate redis, List<Long> ids, ExecutorService exec) throws Exception {
        long t0 = System.nanoTime();
        List<Future<?>> fs = new ArrayList<>(ids.size());
        for (Long m : ids) fs.add(exec.submit(() -> positionWork(redis, m)));
        for (Future<?> f : fs) f.get();
        return (System.nanoTime() - t0) / 1_000_000.0;
    }

    /** RoomQueueConsumerRevised.updatePstsUsersRedisForRoom 과 동일한 방별 작업 */
    private void positionWork(StringRedisTemplate redis, long matchId) {
        String zkey = "queue:" + matchId + ":waiting";
        ZSetOperations<String, String> zset = redis.opsForZSet();
        Long totalL = zset.zCard(zkey);
        long total = (totalL == null) ? 0L : totalL;
        if (total == 0) return;

        Set<String> humanSet = redis.opsForSet().members(QueueKeys.humansSet(matchId));
        if (humanSet == null || humanSet.isEmpty()) return;
        List<String> humans = new ArrayList<>(humanSet);
        long now = System.currentTimeMillis();

        // (1) ZRANK 50개를 한 묶음(파이프라인)으로 → 왕복 1번
        List<Object> rankResults = redis.executePipelined((RedisCallback<Object>) conn -> {
            StringRedisConnection c = (StringRedisConnection) conn;
            for (String u : humans) c.zRank(zkey, u);
            return null;
        });

        // (2) 그 결과로 HSET 도 한 묶음(파이프라인)으로
        redis.executePipelined((RedisCallback<Object>) conn -> {
            StringRedisConnection c = (StringRedisConnection) conn;
            for (int i = 0; i < humans.size() && i < rankResults.size(); i++) {
                Object ro = rankResults.get(i);
                if (!(ro instanceof Number)) continue; // null = 이미 대기열을 빠져나감
                long rank = ((Number) ro).longValue();
                Map<String, String> m = new HashMap<>(4);
                m.put("ahead", Long.toString(rank));
                m.put("behind", Long.toString(total - 1 - rank));
                m.put("total", Long.toString(total));
                m.put("lastUpdated", Long.toString(now));
                String hkey = QueueKeys.userStateKey(matchId, humans.get(i));
                c.hMSet(hkey, m);
                c.expire(hkey, 1800);
            }
            return null;
        });
    }

    private List<Long> seed(StringRedisTemplate redis, int rooms) {
        List<Long> ids = new ArrayList<>(rooms);
        for (long matchId = 1; matchId <= rooms; matchId++) {
            ids.add(matchId);
            ZSetOperations<String, String> zset = redis.opsForZSet();
            String key = "queue:" + matchId + ":waiting";
            int total = USERS + BOTS, chunk = 5000;
            Set<ZSetOperations.TypedTuple<String>> buf = new HashSet<>(chunk * 2);
            Set<String> humans = new HashSet<>(USERS * 2);
            for (int i = 0; i < total; i++) {
                String member = (i < USERS) ? String.valueOf(i + 1) : String.valueOf(-(i - USERS + 1));
                if (i < USERS) humans.add(member);
                buf.add(new DefaultTypedTuple<>(member, (double) i));
                if (buf.size() >= chunk) { zset.add(key, buf); buf.clear(); }
            }
            if (!buf.isEmpty()) zset.add(key, buf);
            redis.opsForSet().add(QueueKeys.humansSet(matchId), humans.toArray(new String[0]));
        }
        return ids;
    }

    private void cleanup(StringRedisTemplate redis, List<Long> ids) {
        for (Long m : ids) {
            redis.delete("queue:" + m + ":waiting");
            redis.delete(QueueKeys.humansSet(m));
        }
    }
}
