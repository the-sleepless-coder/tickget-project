package com.ticketing.queue.service;

import com.ticketing.queue.DTO.request.BotRequestDTO;
import com.ticketing.queue.DTO.response.BotResponseDTO;
import com.ticketing.queue.exception.BotDataRequestFailedException;
import com.ticketing.queue.exception.GetUserNumFailedException;
import com.ticketing.queue.exception.RoomStartStateChangeFailedException;
import io.github.resilience4j.retry.annotation.Retry;
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
     * Bot 서버 HTTP요청
     * */
    @Retry(name = "botDataRequest", fallbackMethod = "sendBotRequestFallback")
    public ResponseEntity<?> sendBotRequest(Long matchId, int botCount, LocalDateTime startTime, String difficulty, Long hallId) {
        String url = botServerUrl + "/matches/" + matchId + "/bots";

        BotRequestDTO body = new BotRequestDTO(botCount, startTime, difficulty, hallId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<BotRequestDTO> entity = new HttpEntity<>(body, headers);

        ResponseEntity<BotResponseDTO> response = restTemplate.exchange(
                url, HttpMethod.POST, entity, BotResponseDTO.class
        );
        log.info("봇 요청 전송 완료 | matchId={} | status={}", matchId, response.getStatusCode());
        return response;
    }

    // 3회의 retry이후 fallback 예외 생성.
    private ResponseEntity<?> sendBotRequestFallback(Long matchId, int botCount, LocalDateTime startTime, String difficulty, Long hallId, Exception e) {
        log.error("봇 서버 요청 폴백 실행: matchId={}, error={}", matchId, e.getMessage());
        throw new BotDataRequestFailedException("봇 서버 호출 실패", e);
    }

    /**
     * Room 서버 HTTP요청
     * */
    @Retry(name = "roomStart", fallbackMethod = "changeStartStateFallback")
    public ResponseEntity<?> changeStartState(Long roomId){
        String url = roomServerUrl + "/rooms/" + roomId + "/start";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        ResponseEntity<String> response = restTemplate.exchange(
                url,
                HttpMethod.PATCH,
                entity,
                String.class
        );
        log.info("Room 서버 시작 요청 전송 완료 | roomId={} | status={}", roomId, response.getStatusCode());
        return response;
    }

    private ResponseEntity<?> changeStartStateFallback(Long roomId, Exception e) {
        log.error("Room 서버 시작 요청 폴백 실행: roomId={}, error={}", roomId, e.getMessage());
        throw new RoomStartStateChangeFailedException("room 서버 상태 변경 실패", e);
    }

    /**
     * Room 서버에 경기 취소 알림
     * */
    public ResponseEntity<?> cancelMatch(Long roomId) {
        String url = roomServerUrl + "/rooms/" + roomId + "/cancel";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        ResponseEntity<String> response = restTemplate.exchange(
                url,
                HttpMethod.PATCH,
                entity,
                String.class
        );
        log.info("Room 서버 경기 취소 요청 완료 | roomId={} | status={}", roomId, response.getStatusCode());
        return response;
    }

    // Room Server에 요청을 보내수 roomId에 대한 사용자 정보를 가져온다.
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
            
            throw new GetUserNumFailedException("사용자 수 조회 실패", e);
        }

    }


}

