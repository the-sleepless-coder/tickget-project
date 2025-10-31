package com.ticketing.seat.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * 좌석 카운트 조회 서비스
 * Redis Counter 방식으로 O(1) 성능 보장
 */
@Service
@RequiredArgsConstructor
public class SeatCountService {

    private final StringRedisTemplate redisTemplate;

    /**
     * 현재 선점된 좌석 수 조회 (O(1))
     * 통계나 대시보드에서 사용
     */
    public long getReservedSeatCount(Long matchId) {
        String countKey = "match:" + matchId + ":reserved_count";
        String value = redisTemplate.opsForValue().get(countKey);
        return value == null ? 0 : Long.parseLong(value);
    }
}