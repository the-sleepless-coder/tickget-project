package com.ticketing.seat.redis;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MatchStatusRepository {

    private final StringRedisTemplate redisTemplate;

    private String key(Long matchId) {
        return "match:" + matchId + ":status";
    }

    /**
     * 현재 Redis에 기록된 상태 ("OPEN" / "CLOSED" / null)
     */
    public String getMatchStatus(Long matchId) {
        return redisTemplate.opsForValue().get(key(matchId));
    }

    /**
     * Redis에 상태 저장
     */
    public void setMatchStatus(Long matchId, String status) {
        redisTemplate.opsForValue().set(key(matchId), status);
    }

    /**
     * 빠른 선점 가능 여부 판단에 사용
     */
    public boolean isOpen(Long matchId) {
        String status = getMatchStatus(matchId);
        return "OPEN".equalsIgnoreCase(status);
    }
}
