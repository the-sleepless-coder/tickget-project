package com.ticketing.repository;

import com.ticketing.entity.Match;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Duration;

@Component
@RequiredArgsConstructor
public class MatchCacheRepository {
    private final MatchRepository matchRepository;
    private final StringRedisTemplate redis;

    private static final int EXPIRE_MINUTES = 30;

    public record MatchCreatedEvent(Long matchId){}

    // DB 커밋 이후 Redis에 roomId, matchId에 대한 정보를 담은 Key 발행.
    public void onMatchCreated(MatchCreatedEvent e){
        // DB에서 해당 matchId에 대한 roomId 조회
        Match m = matchRepository.findById((e.matchId())).orElseThrow();
        String key = "room:%s:match:%s".formatted(m.getRoomId(), m.getMatchId());

        redis.opsForValue().set(key,"1");
        redis.expire(key, Duration.ofMinutes(EXPIRE_MINUTES));
    }




}
