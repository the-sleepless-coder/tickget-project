package com.ticketing.queue.service;

import com.ticketing.entity.Match;
import com.ticketing.queue.DTO.BotRequestDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
public class BotClientService {
    @Value("${bot-service.url}")
    private String botServerUrl;

    private final RestTemplate restTemplate;

    public BotClientService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public ResponseEntity<?> sendBotRequest(Long matchId, int botCount, LocalDateTime startTime, String difficulty, Long hallId) {
        String url = botServerUrl + "/matches/" + matchId + "/bots";

        // 요청 바디
        BotRequestDTO body = new BotRequestDTO(botCount, startTime, difficulty, hallId);

        // 헤더
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<BotRequestDTO> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            log.info("🤖 Bot 요청 전송 완료 | matchId={} | status={}", matchId, response.getStatusCode());
            log.debug("➡️ 응답 본문: {}", response.getBody());
            return response;
        } catch (Exception e) {
            log.error("⚠️ Bot 요청 실패 | matchId={} | reason={}", matchId, e.getMessage(), e);
            // 필요 시 예외 래핑해서 던지거나, 실패 응답 생성해 반환
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body("{\"message\":\"bot request failed\"}");
        }
    }


}

