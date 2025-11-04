package com.tickget.roomserver.service;

import com.tickget.roomserver.dto.request.CreateMatchRequest;
import com.tickget.roomserver.dto.response.MatchResponse;
import com.tickget.roomserver.exception.CreateMatchDeclinedException;
import com.tickget.roomserver.exception.CreateMatchFailedException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Component
@RequiredArgsConstructor
public class TicketingServiceClient {

    private final RestTemplate restTemplate;

    @Value("${ticketing-service.url}")
    private String ticketingServiceUrl;

    @CircuitBreaker(name ="ticketingService")
    @Retry(name="ticketingService", fallbackMethod = "createMatchFallBack")
    public MatchResponse createMatch(CreateMatchRequest request) {
        log.info("방 {}에 매치 생성 요청", request.getRoomId());

        try {
            ResponseEntity<MatchResponse> response = restTemplate.postForEntity(
                    ticketingServiceUrl + "/matches",
                    request,
                    MatchResponse.class
            );
            log.info("방 {}에 매치 {} 생성 성공", response.getBody().getRoomId(), response.getBody().getId());
            return response.getBody();

        } catch (HttpClientErrorException.BadRequest e) {
            log.warn("방 {}에 매치 생성 거부", request.getRoomId());
            throw new CreateMatchDeclinedException("잘못된 요청 정보");
        }
    }

    private MatchResponse createMatchFallBack(CreateMatchRequest request, Exception e) {
        log.error("매치 생성 폴백 실행 : roomId={}, error={}", request.getRoomId(), e.getMessage());
        throw new CreateMatchFailedException("티케팅(매치) 서비스 호출 실패",e);
    }

}
