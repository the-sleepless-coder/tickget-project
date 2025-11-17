package com.ticketing.seat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * Stats 서버와 HTTP 통신을 담당하는 클라이언트 서비스
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StatsServerClient {

    private final RestTemplate restTemplate;

    @Value("${stats-server.url:http://localhost:8084}")
    private String statsServerUrl;

    /**
     * 매치 종료를 Stats 서버에 알림
     * POST /matchstats/{matchId}/end
     *
     * @param matchId 매치 ID
     * @return 성공 여부
     */
    public boolean notifyMatchEnd(Long matchId) {
        String url = statsServerUrl + "/matchstats/" + matchId + "/end";

        try {
            log.info("Stats 서버에 매치 종료 알림 전송: matchId={}, url={}", matchId, url);

            ResponseEntity<Void> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    null,
                    Void.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Stats 서버 매치 종료 알림 성공: matchId={}, status={}",
                        matchId, response.getStatusCode());
                return true;
            } else {
                log.warn("Stats 서버 매치 종료 알림 실패: matchId={}, status={}",
                        matchId, response.getStatusCode());
                return false;
            }

        } catch (Exception e) {
            log.error("Stats 서버 매치 종료 알림 중 오류 발생: matchId={}, error={}",
                    matchId, e.getMessage(), e);
            return false;
        }
    }
}