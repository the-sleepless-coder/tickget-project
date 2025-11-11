package com.ticketing.queue.service;

import com.ticketing.queue.DTO.request.BotRequestDTO;
import com.ticketing.queue.DTO.response.BotResponseDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
@Component
public class ClientService {
    @Value("${bot-server.url}")
    private String botServerUrl;

    @Value("${room-server.url}")
    private String roomServerUrl;

    private final RestTemplate restTemplate;

    public ClientService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }
    /**
     * 봇 서버
     * */
    public ResponseEntity<?> sendBotRequest(Long matchId, int botCount, LocalDateTime startTime, String difficulty, Long hallId) {
        String url = botServerUrl + "/matches/" + matchId + "/bots";

        // 요청 바디
        BotRequestDTO body = new BotRequestDTO(botCount, startTime, difficulty, hallId);

        // 헤더
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<BotRequestDTO> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<BotResponseDTO> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    BotResponseDTO.class
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

    /**
     * 룸 서버
     * */
    public ResponseEntity<?> changeStartState(Long roomId){
        String url = roomServerUrl + "/rooms/" + roomId + "/start";

        // 헤더
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.PATCH,
                    entity,
                    String.class
            );

            log.info(" Room 서버 시작 요청 전송 완료 | roomId={} | status={}", roomId, response.getStatusCode());
            log.debug("➡️ 응답 본문: {}", response.getBody());
            return response;
        } catch (Exception e) {
            log.error("⚠️ Bot 시작 요청 실패 | matchId={} | reason={}", roomId, e.getMessage(), e);
            // 필요 시 예외 래핑해서 던지거나, 실패 응답 생성해 반환
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body("{\"message\":\"bot request failed\"}");
        }
    }

    // 주어진 방의 사용자 정보를 가져온다.
    public ResponseEntity<?> getUserNum(Long roomId){
        String url = roomServerUrl + "/rooms/" + roomId;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Void> request = new HttpEntity<>(headers);

        // Url, 메서드, 요청, 응답
        try{
            ResponseEntity<Map> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    request,
                    Map.class
            );
            Map<String, Object> body = response.getBody();
            if(body != null){
                Integer currentUserCount = (Integer) body.get("currentUserCount");
                log.info("사용자 수: {}를 가져옵니다.", currentUserCount);
                return ResponseEntity.ok(currentUserCount);
            }
            return ResponseEntity.status(HttpStatus.NO_CONTENT)
                    .body("{\"message\": \"no data returned from room server\"}");

        }catch(Exception e){
            e.printStackTrace();
            log.info("사용자 수를 가져오지 못했습니다.");

            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body("{\"message\":\"failed to get user numbers\"}");
        }

    }


}

