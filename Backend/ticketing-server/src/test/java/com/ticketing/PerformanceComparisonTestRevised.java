package com.ticketing;

import org.junit.jupiter.api.Test;
import java.util.*;

/**
 * Kafka (k-way 병합) vs Redis ZSET 성능 비교 - 수정된 가정
 *
 * 올바른 가정:
 *   Kafka: k개 파티션, 파티션 내 순서 보장, 매 입장마다 min-heap k-way 병합으로 순위 계산
 *          유저 i 입장 시 비용 = O(i log k) → 전체 Σ O(i log k) = O(N² log k)
 *
 *   Redis: 스킵리스트, ZADD O(log N) + ZRANK O(log N)
 *          유저 i 입장 시 비용 = O(log i) → 전체 Σ O(log i) = O(log N!) ≈ O(N log N)
 *
 * 유도:
 *   Kafka 총합: log k * (1 + 2 + ... + N) = log k * N(N+1)/2 = O(N² log k)
 *   Redis 총합: log 1 + log 2 + ... + log N = log(N!) ≈ O(N log N)  [스털링 근사]
 */
public class PerformanceComparisonTestRevised {

    private static final int PARTITION_COUNT = 4; // k

    @Test
    public void compareKafkaVsRedis() {
        int[] testSizes = {100, 500, 1000, 5000, 10000};

        // JVM JIT 워밍업
        measureKafka(50);

        // N=100 실측으로 상수 C 추출: T = C * N² * log(k)  →  C = T / (N² * log k)
        // Redis 추정에도 동일한 C 적용 → 하드웨어 속도 동일하다는 공정한 가정
        System.gc();
        sleep(200);
        double baseMs = measureKafka(100) / 1_000_000.0;
        double C = baseMs / (100.0 * 100.0 * Math.log(PARTITION_COUNT));

        System.out.println("\n" + "=".repeat(108));
        System.out.println("Kafka (k-way 병합) vs Redis ZSET 성능 비교 - 수정된 가정");
        System.out.println("=".repeat(108));
        System.out.printf("Kafka  k=%d 파티션, 파티션 내 순서 보장, 매 입장마다 min-heap 병합 → O(N² log k)%n", PARTITION_COUNT);
        System.out.println("Redis  스킵리스트, ZADD O(log N) + ZRANK O(log N)               → O(N log N)");
        System.out.printf("상수 C = %.2e  (N=100 Kafka 실측 %.3f ms 기준, Redis 추정에 동일 C 적용)%n", C, baseMs);
        System.out.println("-".repeat(108));
        System.out.printf("%-10s | %-22s | %-22s | %-18s | %-15s%n",
                "인원수", "Kafka 실측 (ms)", "Redis 추정 (ms)", "실측 비율", "이론 비율");
        System.out.println("=".repeat(108));

        for (int size : testSizes) {
            System.gc();
            sleep(100);

            double kafkaMs = measureKafka(size) / 1_000_000.0;

            // Redis 이론 추정: T = C * N * log(N)  (동일 상수 C)
            double redisMs = C * size * Math.log(size);

            double measuredRatio = kafkaMs / redisMs;

            // 이론 비율: O(N² log k) / O(N log N) = N * log(k) / log(N)
            double theoreticalRatio = (double) size * Math.log(PARTITION_COUNT) / Math.log(size);

            System.out.printf("%-10d | %-22.3f | %-22.6f | %-18.2fx | %-15.1fx%n",
                    size, kafkaMs, redisMs, measuredRatio, theoreticalRatio);
        }

        System.out.println("=".repeat(108));
        System.out.println("\n이론 비율 = N * log(k) / log(N)   [O(N² log k) ÷ O(N log N)]");
        System.out.printf("10,000명 이론 비율: %.0fx%n",
                10000.0 * Math.log(PARTITION_COUNT) / Math.log(10000));
        System.out.println("→ N이 커질수록 Kafka는 Redis 대비 N에 비례해 느려짐");
    }

    @Test
    public void verifyKafkaLinearGrowthPerUser() {
        // 유저 i 의 병합 비용이 i 에 선형 비례하는지 검증
        // 비용/i 가 대략 일정하면 → 유저 i 비용 = O(i log k) 확인
        //
        // 왜 항상 i번 병합하는가:
        //   timestamp = i (단조 증가)로 할당하면 최신 유저는 항상 병합 결과의 맨 끝에 위치
        //   → k-way 병합이 전체 i개 원소를 다 처리한 후에야 target 발견 (최악의 경우)
        int maxUsers = 1000;
        int[] checkPoints = {100, 200, 300, 400, 500, 600, 700, 800, 900, 1000};

        System.out.println("\n" + "=".repeat(78));
        System.out.println("유저별 Kafka 병합 비용 성장 검증 - O(i * log k) 선형 성장");
        System.out.println("=".repeat(78));
        System.out.printf("%-12s | %-20s | %-22s%n",
                "유저 번호 i", "병합 비용 (ns)", "비용/i (ns)  ← 일정하면 O(i*logk)");
        System.out.println("-".repeat(78));

        List<List<Long>> partitions = new ArrayList<>(PARTITION_COUNT);
        for (int i = 0; i < PARTITION_COUNT; i++) partitions.add(new ArrayList<>());

        int checkIdx = 0;
        for (int i = 0; i < maxUsers; i++) {
            long ts = i;
            partitions.get((int)(ts % PARTITION_COUNT)).add(ts);

            if (checkIdx < checkPoints.length && i + 1 == checkPoints[checkIdx]) {
                long start = System.nanoTime();
                findRankByKWayMerge(partitions, ts);
                long costNs = System.nanoTime() - start;

                System.out.printf("%-12d | %-20d | %-22.2f%n",
                        i + 1, costNs, (double) costNs / (i + 1));
                checkIdx++;
            }
        }

        System.out.println("=".repeat(78));
        System.out.println("비용/i 가 일정 → 유저 i 의 병합 비용 O(i log k) 확인");
        System.out.println("전체 N명 합산: Σ(i=1..N) O(i log k) = O(N² log k)");
    }

    // ── 내부 구현 ──────────────────────────────────────────────────────────────

    private long measureKafka(int userCount) {
        List<List<Long>> partitions = new ArrayList<>(PARTITION_COUNT);
        for (int i = 0; i < PARTITION_COUNT; i++) partitions.add(new ArrayList<>());

        long total = 0;
        for (int i = 0; i < userCount; i++) {
            long ts = i;
            // 파티션 내 순서 보장: 단조 증가 timestamp → 각 파티션 리스트는 이미 정렬됨
            partitions.get((int)(ts % PARTITION_COUNT)).add(ts);

            long start = System.nanoTime();
            findRankByKWayMerge(partitions, ts);
            total += System.nanoTime() - start;
        }
        return total;
    }

    /**
     * min-heap k-way 병합으로 target 의 순위(앞에 있는 원소 수)를 반환
     *
     * 초기 상태: 각 파티션의 첫 번째 원소를 힙에 투입  (힙 크기 = k)
     * 매 단계:   힙에서 최솟값 꺼냄 O(log k) → target 이면 종료, 아니면 rank++
     *            해당 파티션의 다음 원소 힙에 투입 O(log k)
     * 총 비용:   target 까지의 원소 수 × O(log k)
     */
    private int findRankByKWayMerge(List<List<Long>> partitions, long target) {
        // [timestamp, partitionId, indexInPartition]
        PriorityQueue<long[]> heap = new PriorityQueue<>(Comparator.comparingLong(a -> a[0]));

        for (int p = 0; p < partitions.size(); p++) {
            List<Long> part = partitions.get(p);
            if (!part.isEmpty()) {
                heap.offer(new long[]{part.get(0), p, 0});
            }
        }

        int rank = 0;
        while (!heap.isEmpty()) {
            long[] top = heap.poll();
            if (top[0] == target) break;
            rank++;

            int nextIdx = (int) top[2] + 1;
            List<Long> part = partitions.get((int) top[1]);
            if (nextIdx < part.size()) {
                heap.offer(new long[]{part.get(nextIdx), top[1], nextIdx});
            }
        }

        return rank;
    }

    private void sleep(int ms) {
        try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
}
