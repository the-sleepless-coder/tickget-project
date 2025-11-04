package com.tickget.roomserver.service;

import com.tickget.roomserver.dto.request.CreateMatchRequest;
import com.tickget.roomserver.dto.response.MatchResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Component
@RequiredArgsConstructor
public class TicketingServiceClient {

    private final RestTemplate restTemplate;

    @Value("${ticketing-service.url}")
    private String ticketingServiceUrl;

    public MatchResponse createMatch(CreateMatchRequest request) {
        log.info("방 {}에 매치 생성 요청", request.getRoomId());

        try {
            ResponseEntity<MatchResponse> response = restTemplate.postForEntity(
                    ticketingServiceUrl + "/matches",
                    request,
                    MatchResponse.class
            );
            log.info("방 {}에 매치 {} 생성 성공", response.getBody().getId(), response.getBody().getId());
            return response.getBody();

        } catch (Exception e) {
            throw e;
        }
    }

}
