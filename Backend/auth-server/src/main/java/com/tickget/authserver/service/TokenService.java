package com.tickget.authserver.service;

import com.tickget.authserver.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * Redis 기반 Refresh Token 관리 서비스
 * - Refresh Token을 Redis에 저장하여 로그아웃 시 무효화 가능
 * - Access Token Blacklist 관리 (로그아웃 시)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TokenService {

    private final StringRedisTemplate redisTemplate;
    private final JwtTokenProvider jwtTokenProvider;

    private static final String REFRESH_TOKEN_PREFIX = "refresh_token:";
    private static final String ACCESS_TOKEN_BLACKLIST_PREFIX = "blacklist:";

    /**
     * Refresh Token을 Redis에 저장
     */
    public void saveRefreshToken(Long userId, String refreshToken) {
        String key = REFRESH_TOKEN_PREFIX + userId;
        long expirationMs = jwtTokenProvider.getRefreshTokenValidityMs();

        redisTemplate.opsForValue().set(
                key,
                refreshToken,
                expirationMs,
                TimeUnit.MILLISECONDS
        );

        log.info("Refresh Token 저장 완료: userId={}", userId);
    }

    /**
     * Refresh Token 조회
     */
    public String getRefreshToken(Long userId) {
        String key = REFRESH_TOKEN_PREFIX + userId;
        return redisTemplate.opsForValue().get(key);
    }

    /**
     * Refresh Token 삭제 (로그아웃 시)
     */
    public void deleteRefreshToken(Long userId) {
        String key = REFRESH_TOKEN_PREFIX + userId;
        redisTemplate.delete(key);
        log.info("Refresh Token 삭제 완료: userId={}", userId);
    }

    /**
     * Refresh Token 검증 (Redis에 저장된 토큰과 일치하는지 확인)
     */
    public boolean validateRefreshToken(Long userId, String refreshToken) {
        String storedToken = getRefreshToken(userId);
        return storedToken != null && storedToken.equals(refreshToken);
    }

    /**
     * Access Token을 Blacklist에 추가 (로그아웃 시)
     */
    public void addToBlacklist(String accessToken, long expirationMs) {
        String key = ACCESS_TOKEN_BLACKLIST_PREFIX + accessToken;

        redisTemplate.opsForValue().set(
                key,
                "blacklisted",
                expirationMs,
                TimeUnit.MILLISECONDS
        );

        log.info("Access Token Blacklist 추가 완료");
    }

    /**
     * Access Token이 Blacklist에 있는지 확인
     */
    public boolean isBlacklisted(String accessToken) {
        String key = ACCESS_TOKEN_BLACKLIST_PREFIX + accessToken;
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }
}
