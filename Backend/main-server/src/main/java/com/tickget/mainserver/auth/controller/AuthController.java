package com.tickget.mainserver.auth.controller;

import com.tickget.mainserver.auth.jwt.JwtTokenProvider;
import com.tickget.mainserver.user.entity.User;
import com.tickget.mainserver.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 인증 관련 REST API 컨트롤러 (JWT 기반)
 */
@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;

    /**
     * 현재 로그인한 사용자 정보 조회
     * Authorization: Bearer {accessToken}
     */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser(Authentication authentication) {

        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "로그인이 필요합니다."));
        }

        Long userId = (Long) authentication.getPrincipal();

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("userId", user.getId());
        userInfo.put("email", user.getEmail());
        userInfo.put("nickname", user.getNickname());
        userInfo.put("name", user.getName());

        return ResponseEntity.ok(userInfo);
    }

    /**
     * Access Token 재발급
     * Refresh Token을 받아서 새로운 Access Token 발급
     */
    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refreshToken(@RequestBody Map<String, String> request) {

        String refreshToken = request.get("refreshToken");

        if (refreshToken == null || !jwtTokenProvider.validateToken(refreshToken)) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "유효하지 않은 Refresh Token입니다."));
        }

        try {
            Long userId = jwtTokenProvider.getUserId(refreshToken);
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

            // 새로운 Access Token 생성
            String newAccessToken = jwtTokenProvider.createAccessToken(user.getId(), user.getEmail());

            log.info("Access Token 재발급: userId={}", userId);

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
     * 헬스 체크
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "OK"));
    }
}