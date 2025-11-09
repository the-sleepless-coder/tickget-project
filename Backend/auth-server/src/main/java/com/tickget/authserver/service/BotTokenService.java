package com.tickget.authserver.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Bot 토큰 관리 서비스
 * - Redis에 단일 Bot 토큰 저장 및 검증
 * - 모든 Bot이 동일한 토큰 사용
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BotTokenService {

    private final StringRedisTemplate redisTemplate;

    private static final String BOT_TOKEN_KEY = "bot_token";

    /**
     * Bot 토큰 검증
     * Redis에 저장된 토큰과 일치하는지 확인
     */
    public boolean isValidBotToken(String token) {
        if (token == null || token.isEmpty()) {
            return false;
        }

        String storedToken = redisTemplate.opsForValue().get(BOT_TOKEN_KEY);
        boolean isValid = token.equals(storedToken);

        if (isValid) {
            log.info("Bot 토큰 검증 성공");
        } else {
            log.warn("Bot 토큰 검증 실패: 토큰 불일치");
        }

        return isValid;
    }

    /**
     * Bot 토큰 생성 및 Redis에 저장
     * 관리자가 수동으로 호출하여 Bot 토큰 생성
     *
     * @return 생성된 Bot 토큰
     */
    public String generateAndSaveBotToken() {
        // UUID 기반 랜덤 토큰 생성
        String botToken = "bot_" + UUID.randomUUID().toString().replace("-", "");

        // Redis에 영구 저장 (만료 시간 없음)
        redisTemplate.opsForValue().set(BOT_TOKEN_KEY, botToken);

        log.info("Bot 토큰 생성 및 저장 완료: {}", botToken);

        return botToken;
    }

    /**
     * 현재 저장된 Bot 토큰 조회
     */
    public String getCurrentBotToken() {
        return redisTemplate.opsForValue().get(BOT_TOKEN_KEY);
    }

    /**
     * Bot 토큰 삭제
     */
    public void deleteBotToken() {
        redisTemplate.delete(BOT_TOKEN_KEY);
        log.info("Bot 토큰 삭제 완료");
    }
}
