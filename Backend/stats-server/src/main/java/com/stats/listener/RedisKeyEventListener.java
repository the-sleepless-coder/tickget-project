package com.stats.listener;

import com.stats.service.StatsBatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RedisKeyEventListener {
    private final StatsBatchService statsBatchService;
    private final RedisTemplate<String, String> redisTemplate;

    private static final String HUMAN_USER_KEY_PREFIX = "humanusers:match:";

    public void handleMessage(String key) {
        log.info("Redis key changed: {}", key);

        // key 형식이 "humanusers:match:{matchId}"인지 체크
        if (key.startsWith(HUMAN_USER_KEY_PREFIX)) {

            // 1. matchId 추출
            String matchIdStr = key.replace(HUMAN_USER_KEY_PREFIX, "");
            Long matchId;
            try {
                matchId = Long.parseLong(matchIdStr);
            } catch (NumberFormatException e) {
                log.warn("Invalid matchId in key: {}", key);
                return;
            }

            // 2. Redis에서 값 조회
            String value = redisTemplate.opsForValue().get(key);

            log.info("MatchId = {}, Value = {}", matchId, value);

            // 3. 값이 0이면 → 매치 통계 실행
            if ("0".equals(value)) {
                log.info("Match {}: humanusercount is 0 → Triggering StatsBatch", matchId);
                statsBatchService.updateMatchStats(matchId);
            }
        }
    }
}
