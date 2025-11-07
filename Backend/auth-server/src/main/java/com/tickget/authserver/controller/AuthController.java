package com.tickget.authserver.controller;

import com.tickget.authserver.dto.TokenResponse;
import com.tickget.authserver.dto.UserResponse;
import com.tickget.authserver.dto.ValidationResponse;
import com.tickget.authserver.entity.User;
import com.tickget.authserver.jwt.JwtTokenProvider;
import com.tickget.authserver.repository.UserRepository;
import com.tickget.authserver.service.TokenService;
import io.jsonwebtoken.ExpiredJwtException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 인증 관련 REST API 컨트롤러 (JWT 기반)
 * - 개선된 MSA 인증 아키텍처
 * - Traefik ForwardAuth 지원
 * - Redis 기반 Refresh Token 관리
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class AuthController {

    private final JwtTokenProvider jwtTokenProvider;
    private final TokenService tokenService;
    private final UserRepository userRepository;

    /**
     * 현재 로그인한 사용자 정보 조회
     * Authorization: Bearer {accessToken}
     */
    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser(Authentication authentication) {

        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        Long userId = (Long) authentication.getPrincipal();

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        // User 엔티티 → UserResponse DTO 변환
        return ResponseEntity.ok(UserResponse.from(user));
    }

    /**
     * Access Token 재발급
     * - Refresh Token을 HttpOnly Cookie에서 읽음
     * - 새로운 Access Token 발급 (Response Body)
     * - Refresh Token Rotation: 새로운 Refresh Token도 발급 (Cookie)
     */
    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refreshToken(
            @CookieValue(value = "refreshToken", required = false) String refreshToken,
            jakarta.servlet.http.HttpServletResponse httpResponse) {

        // Cookie에서 Refresh Token 확인
        if (refreshToken == null || refreshToken.isEmpty()) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "Refresh Token이 없습니다. 다시 로그인해주세요."));
        }

        // Refresh Token 유효성 검증
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "유효하지 않은 Refresh Token입니다."));
        }

        // Refresh Token 타입 검증
        if (!jwtTokenProvider.isRefreshToken(refreshToken)) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "Refresh Token이 아닙니다."));
        }

        try {
            Long userId = jwtTokenProvider.getUserId(refreshToken);

            // Redis에 저장된 Refresh Token과 일치하는지 확인
            if (!tokenService.validateRefreshToken(userId, refreshToken)) {
                return ResponseEntity.status(401)
                        .body(Map.of("message", "Refresh Token이 일치하지 않습니다. 다시 로그인해주세요."));
            }

            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

            // 새로운 Access Token 생성
            String newAccessToken = jwtTokenProvider.createAccessToken(user.getId(), user.getEmail());

            // Refresh Token Rotation: 새로운 Refresh Token 생성
            String newRefreshToken = jwtTokenProvider.createRefreshToken(user.getId());

            // 새 Refresh Token을 Redis에 저장 (기존 것 교체)
            tokenService.saveRefreshToken(user.getId(), newRefreshToken);

            // 새 Refresh Token을 HttpOnly Cookie로 설정
            jakarta.servlet.http.Cookie refreshTokenCookie = new jakarta.servlet.http.Cookie("refreshToken", newRefreshToken);
            refreshTokenCookie.setHttpOnly(true);
            refreshTokenCookie.setSecure(true);
            refreshTokenCookie.setPath("/");
            refreshTokenCookie.setMaxAge(7 * 24 * 60 * 60);  // 7일
            refreshTokenCookie.setAttribute("SameSite", "Lax");
            httpResponse.addCookie(refreshTokenCookie);

            log.info("Access Token 재발급 (Refresh Token Rotation 적용): userId={}", userId);

            Map<String, String> response = new HashMap<>();
            response.put("accessToken", newAccessToken);
            response.put("message", "토큰 재발급 성공");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("토큰 재발급 실패: {}", e.getMessage());
            return ResponseEntity.status(401)
                    .body(Map.of("message", "토큰 재발급 실패"));
        }
    }

    /**
     * 로그아웃
     * - Refresh Token을 Redis에서 삭제
     * - Refresh Token Cookie 삭제
     * - Access Token을 Blacklist에 추가
     */
    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(
            @RequestHeader("Authorization") String authHeader,
            Authentication authentication,
            jakarta.servlet.http.HttpServletResponse httpResponse) {

        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "로그인이 필요합니다."));
        }

        Long userId = (Long) authentication.getPrincipal();

        // Refresh Token 삭제 (Redis)
        tokenService.deleteRefreshToken(userId);

        // Refresh Token Cookie 삭제
        jakarta.servlet.http.Cookie refreshTokenCookie = new jakarta.servlet.http.Cookie("refreshToken", null);
        refreshTokenCookie.setHttpOnly(true);
        refreshTokenCookie.setSecure(true);
        refreshTokenCookie.setPath("/");
        refreshTokenCookie.setMaxAge(0);  // 즉시 삭제
        httpResponse.addCookie(refreshTokenCookie);

        // Access Token을 Blacklist에 추가
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String accessToken = authHeader.substring(7);

            try {
                // 토큰의 남은 유효기간 동안만 Blacklist에 유지
                long expirationMs = jwtTokenProvider.getRefreshTokenValidityMs();
                tokenService.addToBlacklist(accessToken, expirationMs);
            } catch (ExpiredJwtException e) {
                // 이미 만료된 토큰은 Blacklist에 추가할 필요 없음
                log.debug("이미 만료된 토큰: {}", e.getMessage());
            }
        }

        log.info("로그아웃 성공: userId={}, Cookie 삭제됨", userId);

        return ResponseEntity.ok(Map.of("message", "로그아웃 성공"));
    }

    /**
     * JWT 토큰 검증 (다른 마이크로서비스에서 호출)
     * Traefik ForwardAuth 미들웨어용 엔드포인트
     *
     * Traefik ForwardAuth 동작 방식:
     * 1. 클라이언트 요청 -> Traefik
     * 2. Traefik -> Auth Server (이 엔드포인트)
     * 3. 200 OK -> 요청 통과, 401/403 -> 요청 거부
     *
     * 헤더 전달:
     * - X-User-Id: 사용자 ID
     * - X-User-Email: 사용자 이메일
     */
    @GetMapping("/validate")
    public ResponseEntity<ValidationResponse> validateToken(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("Authorization 헤더가 없거나 형식이 잘못되었습니다");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ValidationResponse.builder()
                            .valid(false)
                            .message("Authorization 헤더가 필요합니다")
                            .build());
        }

        String token = authHeader.substring(7);

        // 토큰 유효성 검증
        if (!jwtTokenProvider.validateToken(token)) {
            log.warn("유효하지 않은 토큰");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ValidationResponse.builder()
                            .valid(false)
                            .message("유효하지 않은 토큰")
                            .build());
        }

        // Access Token 타입 검증
        if (!jwtTokenProvider.isAccessToken(token)) {
            log.warn("Access Token이 아닙니다");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ValidationResponse.builder()
                            .valid(false)
                            .message("Access Token이 아닙니다")
                            .build());
        }

        // Blacklist 확인
        if (tokenService.isBlacklisted(token)) {
            log.warn("Blacklist에 등록된 토큰");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ValidationResponse.builder()
                            .valid(false)
                            .message("로그아웃된 토큰입니다")
                            .build());
        }

        try {
            Long userId = jwtTokenProvider.getUserId(token);
            String email = jwtTokenProvider.getEmail(token);

            log.debug("토큰 검증 성공: userId={}, email={}", userId, email);

            // Traefik ForwardAuth를 위한 커스텀 헤더 추가
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-User-Id", userId.toString());
            headers.set("X-User-Email", email);

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(ValidationResponse.builder()
                            .valid(true)
                            .userId(userId)
                            .email(email)
                            .message("유효한 토큰")
                            .build());

        } catch (Exception e) {
            log.error("토큰 검증 실패: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ValidationResponse.builder()
                            .valid(false)
                            .message("토큰 검증 실패")
                            .build());
        }
    }

    /**
     * 헬스 체크 (인증 불필요)
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        log.info("✅✅✅ /health endpoint reached in Controller ✅✅✅");
        return ResponseEntity.ok(Map.of("status", "OK", "service", "auth-server"));
    }
}
