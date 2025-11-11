package com.ticketing.seat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * 룸 서버와 HTTP 통신을 담당하는 클라이언트 서비스
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RoomServerClient {

    private final RestTemplate restTemplate;

    @Value("${room-server.url:http://localhost:8083}")
    private String roomServerUrl;

    /**
     * 매치 종료를 룸 서버에 알림
     * PATCH /rooms/{roomId}/end
     *
     * @param roomId 방 ID
     * @return 성공 여부
     */
    public boolean notifyMatchEnd(Long roomId) {
        String url = roomServerUrl + "/rooms/" + roomId + "/end";

        try {
            log.info("룸 서버에 매치 종료 알림 전송: roomId={}, url={}", roomId, url);

            ResponseEntity<Void> response = restTemplate.exchange(
                    url,
                    HttpMethod.PATCH,
                    null,
                    Void.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("룸 서버 매치 종료 알림 성공: roomId={}, status={}",
                        roomId, response.getStatusCode());
                return true;
            } else {
                log.warn("룸 서버 매치 종료 알림 실패: roomId={}, status={}",
                        roomId, response.getStatusCode());
                return false;
            }

        } catch (Exception e) {
            log.error("룸 서버 매치 종료 알림 중 오류 발생: roomId={}, error={}",
                    roomId, e.getMessage(), e);
            return false;
        }
    }
}