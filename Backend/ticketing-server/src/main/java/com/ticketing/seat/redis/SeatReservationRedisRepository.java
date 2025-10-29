package com.ticketing.seat.redis;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class SeatReservationRedisRepository {

    private final StringRedisTemplate redisTemplate;

    private String seatKey(Long matchId, String seatId) {
        return "seat:" + matchId + ":" + seatId;
    }

    /**
     * 단일 좌석을 userId에게 선점 시도
     * 이미 누군가 있으면 false, 비어있으면 true
     */
    public boolean tryReserveSingleSeat(Long matchId, String seatId, Long userId) {
        Boolean ok = redisTemplate
                .opsForValue()
                .setIfAbsent(seatKey(matchId, seatId), userId.toString());
        return Boolean.TRUE.equals(ok);
    }

    /**
     * 좌석 점유자 조회
     */
    public Optional<Long> findOwner(Long matchId, String seatId) {
        String val = redisTemplate.opsForValue().get(seatKey(matchId, seatId));
        if (val == null) return Optional.empty();
        return Optional.of(Long.valueOf(val));
    }

    /**
     * 좌석 해제(청소용)
     */
    public void releaseSeat(Long matchId, String seatId) {
        redisTemplate.delete(seatKey(matchId, seatId));
    }
}
