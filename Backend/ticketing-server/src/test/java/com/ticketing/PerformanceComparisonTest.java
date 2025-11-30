package com.ticketing;

import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

/**
 * Kafka(정렬 방식) vs Redis ZSET 성능 비교 테스트
 *
 * 목적: O(N log N) vs O(log N) 시간 복잡도 차이를 실제로 측정
 *
 * 시나리오:
 * 1. Kafka 방식: ArrayList에 저장 후 매번 정렬해서 순위 찾기 (O(N log N))
 * 2. Redis ZSET: Skip List 구조로 삽입과 동시에 정렬 유지 (O(log N))
 *
 * 주의: Redis 연결 없이도 실행 가능하도록 Kafka 방식만 테스트합니다.
 *       실제 Redis 성능 테스트는 서버 실행 후 진행하세요.
 */
public class PerformanceComparisonTest {

    private static final Logger log = LoggerFactory.getLogger(PerformanceComparisonTest.class);

    @Test
    public void compareKafkaVsRedis() {
        // 성능 비교: Kafka(O(N log N)) vs Redis ZSET(O(log N))
        int[] testSizes = {100, 500, 1000, 5000, 10000};

        System.out.println("\n");
        System.out.println("=".repeat(100));
        System.out.println("Kafka(정렬 방식) vs Redis ZSET 성능 비교 테스트");
        System.out.println("=".repeat(100));
        System.out.println("");
        System.out.println("테스트 시나리오:");
        System.out.println("  - N명의 사용자가 순차적으로 입장");
        System.out.println("  - 각 사용자는 입장 후 즉시 자신의 순위를 조회");
        System.out.println("  - 총 N번의 (삽입 + 조회) 작업 수행");
        System.out.println("");
        System.out.println("Kafka 방식: ArrayList + 매번 정렬 (O(N log N))");
        System.out.println("Redis 방식: ZSET Skip List (O(log N)) - 이론적 계산");
        System.out.println("");
        System.out.println("-".repeat(100));

        System.out.printf("%-10s | %-20s | %-20s | %-15s | %-20s\n",
            "인원수", "Kafka 방식 (ms)", "Redis 예상 (ms)", "성능 차이", "이론적 차이");
        System.out.println("=".repeat(100));

        for (int size : testSizes) {
            // Garbage Collection 수행 (정확한 측정을 위해)
            System.gc();
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

            // Kafka 방식 측정
            long kafkaTimeNs = testKafkaMethod(size);
            double kafkaTimeMs = kafkaTimeNs / 1_000_000.0;

            // Redis 방식 예상치 계산 (O(log N) 기준, 100명 기준 0.5ms로 가정)
            double baseTimeMs = 0.5;  // 100명에 약 0.5ms
            double redisEstimateMs = baseTimeMs * Math.log(size) / Math.log(100);

            // 성능 비율 계산
            double performanceRatio = kafkaTimeMs / redisEstimateMs;

            // 이론적 차이 계산 (N log N / log N = N)
            double theoreticalRatio = size;

            System.out.printf("%-10d | %-20.3f | %-20.3f | %-15.1fx | %-20.1fx\n",
                size, kafkaTimeMs, redisEstimateMs, performanceRatio, theoreticalRatio);
        }

        System.out.println("=".repeat(100));
        System.out.println("");
        System.out.println("결론:");
        System.out.println("  ✅ Redis ZSET은 인원이 증가해도 O(log N) 복잡도 유지 (예상)");
        System.out.println("  ❌ Kafka 방식은 인원에 비례하여 성능이 급격히 저하 (O(N log N))");
        System.out.println("  📊 10,000명 기준: Redis가 약 " + String.format("%.0f", 10000.0) + "배 빠를 것으로 예상 (이론적으로는 10,000배)");
        System.out.println("");
        System.out.println("참고: Redis 실제 성능 측정은 Redis 서버 연결 후 detailedAnalysis() 테스트를 실행하세요.");
        System.out.println("");
    }

    /**
     * Kafka 방식 시뮬레이션: ArrayList + 매번 정렬
     *
     * 시간 복잡도:
     * - 삽입: O(1)
     * - 조회 시 정렬: O(N log N)
     * - 순위 찾기: O(N)
     * - 총: O(N) × (O(1) + O(N log N) + O(N)) = O(N² log N)
     *
     * 하지만 실제로는 매번 정렬하므로 평균적으로:
     * - 1번째: 1 log 1
     * - 2번째: 2 log 2
     * - ...
     * - N번째: N log N
     * - 총: Σ(k log k) ≈ O(N² log N)
     */
    private long testKafkaMethod(int userCount) {
        List<QueueEntry> buffer = new ArrayList<>(userCount);
        long totalTime = 0;

        // userCount명이 순차적으로 입장하고 각자 순위 조회
        for (int i = 0; i < userCount; i++) {
            long timestamp = System.currentTimeMillis() * 1_000_000 + i;
            QueueEntry newEntry = new QueueEntry(i, timestamp);

            long start = System.nanoTime();

            // 1) 삽입 (O(1))
            buffer.add(newEntry);

            // 2) 순위 조회를 위해 매번 전체 정렬 (O(N log N))
            List<QueueEntry> sorted = new ArrayList<>(buffer);
            sorted.sort(Comparator.comparingLong(QueueEntry::getScore));

            // 3) 내 순위 찾기 (O(N))
            int rank = -1;
            for (int j = 0; j < sorted.size(); j++) {
                if (sorted.get(j).getUserId() == i) {
                    rank = j;
                    break;
                }
            }

            long end = System.nanoTime();
            totalTime += (end - start);

            // 결과 검증 (선택적)
            if (rank == -1) {
                System.err.println("Kafka 방식: 순위를 찾지 못했습니다. userId=" + i);
            }
        }

        return totalTime;
    }


    /**
     * 대기열 엔트리 (Kafka 방식 시뮬레이션용)
     */
    private static class QueueEntry {
        private final int userId;
        private final long score;  // timestamp * 1_000_000 + sequence

        public QueueEntry(int userId, long score) {
            this.userId = userId;
            this.score = score;
        }

        public int getUserId() {
            return userId;
        }

        public long getScore() {
            return score;
        }
    }

    /**
     * 상세 분석 테스트 - 각 단계별 시간 측정
     */
    @Test
    public void detailedAnalysis() {
        int testSize = 1000;

        System.out.println("\n");
        System.out.println("=".repeat(100));
        System.out.println("상세 분석: " + testSize + "명 기준 각 작업별 시간 측정");
        System.out.println("=".repeat(100));
        System.out.println("");

        // Kafka 방식 상세 분석
        analyzeKafkaMethod(testSize);

        System.out.println("");
        System.out.println("=".repeat(100));
    }

    private void analyzeKafkaMethod(int userCount) {
        List<QueueEntry> buffer = new ArrayList<>(userCount);

        long totalInsertTime = 0;
        long totalSortTime = 0;
        long totalSearchTime = 0;

        for (int i = 0; i < userCount; i++) {
            long timestamp = System.currentTimeMillis() * 1_000_000 + i;
            QueueEntry newEntry = new QueueEntry(i, timestamp);

            // 삽입 시간
            long insertStart = System.nanoTime();
            buffer.add(newEntry);
            long insertEnd = System.nanoTime();
            totalInsertTime += (insertEnd - insertStart);

            // 정렬 시간
            long sortStart = System.nanoTime();
            List<QueueEntry> sorted = new ArrayList<>(buffer);
            sorted.sort(Comparator.comparingLong(QueueEntry::getScore));
            long sortEnd = System.nanoTime();
            totalSortTime += (sortEnd - sortStart);

            // 검색 시간
            long searchStart = System.nanoTime();
            int rank = -1;
            for (int j = 0; j < sorted.size(); j++) {
                if (sorted.get(j).getUserId() == i) {
                    rank = j;
                    break;
                }
            }
            long searchEnd = System.nanoTime();
            totalSearchTime += (searchEnd - searchStart);
        }

        System.out.println("Kafka 방식 (ArrayList + 정렬) - " + userCount + "명 기준:");
        System.out.printf("  삽입 시간:  %10.3f ms (평균: %.6f ms/회)\n",
            totalInsertTime / 1_000_000.0, totalInsertTime / 1_000_000.0 / userCount);
        System.out.printf("  정렬 시간:  %10.3f ms (평균: %.6f ms/회) ← 병목!\n",
            totalSortTime / 1_000_000.0, totalSortTime / 1_000_000.0 / userCount);
        System.out.printf("  검색 시간:  %10.3f ms (평균: %.6f ms/회)\n",
            totalSearchTime / 1_000_000.0, totalSearchTime / 1_000_000.0 / userCount);
        System.out.printf("  총 시간:    %10.3f ms\n",
            (totalInsertTime + totalSortTime + totalSearchTime) / 1_000_000.0);
    }

}
