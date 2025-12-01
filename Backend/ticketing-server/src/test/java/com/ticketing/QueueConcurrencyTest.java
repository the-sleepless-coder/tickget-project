package com.ticketing;

import com.ticketing.queue.DTO.QueueUserInfoDTO;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

/**
 * Queue API 동시성 테스트
 * Python auto_queue.py 스크립트의 Java 버전
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
public class QueueConcurrencyTest {

    private static final Logger log = LoggerFactory.getLogger(QueueConcurrencyTest.class);

    private static final String API_BASE = "http://localhost:8082";
    private static final String TICKETING_PREFIX = "/ticketing";
    private static final String PATH = "/queue";
    private static final Long MATCH_ID = 35L;
    private static final int PLAYER_NUM = 20;
    private static final int MAX_WORKERS = 20;

    /**
     * 단일 요청을 보내는 메서드
     */
    private TestResult sendRequest(long userId, long matchId) {
        String url = API_BASE + TICKETING_PREFIX + PATH + "/" + matchId;

        RestTemplate restTemplate = new RestTemplate();

        // 헤더 설정
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", String.valueOf(userId));
        headers.setContentType(MediaType.APPLICATION_JSON);

        // Request Body 설정 (QueueUserInfoDTO 구조)
        QueueUserInfoDTO body = new QueueUserInfoDTO(0, 0.0f);

        HttpEntity<QueueUserInfoDTO> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                request,
                String.class
            );

            return new TestResult(userId, response.getStatusCodeValue(), response.getBody());
        } catch (Exception e) {
            return new TestResult(userId, -1, "ERROR: " + e.getMessage());
        }
    }

    /**
     * 동시성 테스트 메인 로직
     */
    @Test
    public void testConcurrentQueueRequests() throws InterruptedException {
        // userId 생성: 1~20, -1~-20
        List<Long> userIds = new ArrayList<>();
        IntStream.rangeClosed(1, PLAYER_NUM).forEach(i -> userIds.add((long) i));
        IntStream.rangeClosed(1, PLAYER_NUM).forEach(i -> userIds.add((long) -i));

        List<TestResult> results = new ArrayList<>();
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);

        // ThreadPoolExecutor 설정
        ExecutorService executor = Executors.newFixedThreadPool(MAX_WORKERS);
        List<Future<TestResult>> futures = new ArrayList<>();

        log.info("=== 동시성 테스트 시작 ===");
        log.info("총 요청 수: {}, 매치 ID: {}", userIds.size(), MATCH_ID);

        // 모든 요청을 동시에 실행
        for (Long userId : userIds) {
            Future<TestResult> future = executor.submit(() -> sendRequest(userId, MATCH_ID));
            futures.add(future);
        }

        // 결과 수집
        for (Future<TestResult> future : futures) {
            try {
                TestResult result = future.get();
                results.add(result);

                // 로그 출력
                String responsePreview = result.response.length() > 120
                    ? result.response.substring(0, 120)
                    : result.response;
                log.info("[userId={}] -> {}: {}", result.userId, result.statusCode, responsePreview);

                // 성공/실패 카운트
                if (result.statusCode == 200) {
                    successCount.incrementAndGet();
                } else {
                    failCount.incrementAndGet();
                }
            } catch (ExecutionException | InterruptedException e) {
                log.error("Future 실행 중 에러 발생", e);
                failCount.incrementAndGet();
            }
        }

        // ExecutorService 종료
        executor.shutdown();
        executor.awaitTermination(10, TimeUnit.SECONDS);

        // 요약 출력
        log.info("\n=== 요약 ===");
        log.info("성공: {}, 실패: {}", successCount.get(), failCount.get());
        log.info("전체: {}", results.size());

        // 실패한 요청 상세 정보
        results.stream()
            .filter(r -> r.statusCode != 200)
            .forEach(r -> log.warn("실패한 요청 - userId: {}, status: {}, response: {}",
                r.userId, r.statusCode, r.response));
    }

    /**
     * 테스트 결과를 담는 내부 클래스
     */
    private static class TestResult {
        long userId;
        int statusCode;
        String response;

        TestResult(long userId, int statusCode, String response) {
            this.userId = userId;
            this.statusCode = statusCode;
            this.response = response;
        }
    }
}
