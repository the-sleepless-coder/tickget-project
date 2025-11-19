package com.tickget.authserver.controller;

import com.tickget.authserver.dto.TestLoginResponse;
import com.tickget.authserver.service.AdminUserService;
import com.tickget.authserver.service.BotTokenService;
import com.tickget.authserver.service.TestUserService;
import com.tickget.authserver.service.TokenService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 테스트용 API 컨트롤러
 * - 테스트 유저 자동 생성 및 로그인
 * - Bot 토큰 관리
 */
@Slf4j
@RestController
@RequestMapping("/test")
@RequiredArgsConstructor
public class TestController {

    private final TestUserService testUserService;
    private final AdminUserService adminUserService;
    private final BotTokenService botTokenService;

    /**
     * 테스트 유저 생성 및 자동 로그인
     *
     * Request Body 없음 - 호출하면 자동으로 랜덤 테스트 유저 생성
     *
     * Response:
     * - accessToken: JWT Access Token (Bearer 토큰으로 사용)
     * - refreshToken: HttpOnly Cookie로 자동 설정됨
     * - userId: 생성된 유저 ID
     * - email: 생성된 이메일
     * - nickname: 생성된 닉네임
     * - name: 생성된 이름
     *
     * @return TestLoginResponse 테스트 유저 정보 및 Access Token
     */
    @PostMapping("/login")
    public ResponseEntity<TestLoginResponse> createTestUserAndLogin(HttpServletResponse httpResponse) {
        log.info("게스트 유저 생성 및 로그인 API 호출");

        try {
            // 게스트 유저 생성 및 로그인 처리
            TestLoginResponse response = testUserService.createTestUserAndLogin();

            // Refresh Token을 HttpOnly Cookie로 설정
            // OAuth2LoginSuccessHandler와 동일한 방식
            // Note: refreshToken은 이미 Redis에 저장됨 (TestUserService에서 처리)
            jakarta.servlet.http.Cookie refreshTokenCookie = new jakarta.servlet.http.Cookie(
                    "refreshToken",
                    response.getRefreshToken()
            );
            refreshTokenCookie.setHttpOnly(true);  // JavaScript 접근 불가 (보안)
            refreshTokenCookie.setSecure(true);    // HTTPS only
            refreshTokenCookie.setPath("/");       // 모든 경로에서 전송
            refreshTokenCookie.setMaxAge(7 * 24 * 60 * 60);  // 7일
            refreshTokenCookie.setAttribute("SameSite", "Lax");  // CSRF 방지
            httpResponse.addCookie(refreshTokenCookie);

            // Response에서 refreshToken 제거 (보안상 Cookie에만 포함)
            response.setRefreshToken(null);

            log.info("게스트 유저 생성 및 로그인 성공: userId={}, email={}, nickname={}",
                    response.getUserId(), response.getEmail(), response.getNickname());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("게스트 유저 생성 실패", e);
            return ResponseEntity.status(500)
                    .body(TestLoginResponse.builder()
                            .message("게스트 유저 생성 실패: " + e.getMessage())
                            .build());
        }
    }

    /**
     * 관리자 로그인
     *
     * Request Body:
     * - nickname: 관리자 닉네임 (승수, 유나, 재원, 종환, 재석, 휘, 채준)
     *
     * Response:
     * - accessToken: JWT Access Token (30일 유효기간)
     * - refreshToken: HttpOnly Cookie로 자동 설정됨
     * - userId, email, nickname, name: 관리자 정보
     */
    @PostMapping("/admin/login")
    public ResponseEntity<TestLoginResponse> adminLogin(
            @RequestBody Map<String, String> request,
            HttpServletResponse httpResponse) {
        String nickname = request.get("nickname");

        if (nickname == null || nickname.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(TestLoginResponse.builder()
                            .message("닉네임을 입력해주세요")
                            .build());
        }

        log.info("관리자 로그인 API 호출: nickname={}", nickname);

        try {
            // 관리자 로그인 처리 (nickname으로 검색)
            TestLoginResponse response = adminUserService.loginAsAdmin(nickname);

            // Refresh Token을 HttpOnly Cookie로 설정
            jakarta.servlet.http.Cookie refreshTokenCookie = new jakarta.servlet.http.Cookie(
                    "refreshToken",
                    response.getRefreshToken()
            );
            refreshTokenCookie.setHttpOnly(true);
            refreshTokenCookie.setSecure(true);
            refreshTokenCookie.setPath("/");
            refreshTokenCookie.setMaxAge(7 * 24 * 60 * 60);  // 7일
            refreshTokenCookie.setAttribute("SameSite", "Lax");
            httpResponse.addCookie(refreshTokenCookie);

            // Response에서 refreshToken 제거 (보안상 Cookie에만 포함)
            response.setRefreshToken(null);

            log.info("관리자 로그인 성공: userId={}, email={}, nickname={}",
                    response.getUserId(), response.getEmail(), response.getNickname());

            return ResponseEntity.ok(response);

        } catch (RuntimeException e) {
            log.error("관리자 로그인 실패: {}", e.getMessage());
            return ResponseEntity.status(404)
                    .body(TestLoginResponse.builder()
                            .message("관리자 계정을 찾을 수 없습니다: " + nickname)
                            .build());
        } catch (Exception e) {
            log.error("관리자 로그인 실패", e);
            return ResponseEntity.status(500)
                    .body(TestLoginResponse.builder()
                            .message("관리자 로그인 실패: " + e.getMessage())
                            .build());
        }
    }

    /**
     * Bot 토큰 생성
     * 관리자가 수동으로 호출하여 Bot 토큰 생성 및 Redis 저장
     *
     * @return 생성된 Bot 토큰
     */
    @PostMapping("/bot-token/generate")
    public ResponseEntity<Map<String, String>> generateBotToken() {
        log.info("Bot 토큰 생성 API 호출");

        try {
            String botToken = botTokenService.generateAndSaveBotToken();

            log.info("Bot 토큰 생성 성공");

            return ResponseEntity.ok(Map.of(
                    "botToken", botToken,
                    "message", "Bot 토큰 생성 및 Redis 저장 완료"
            ));

        } catch (Exception e) {
            log.error("Bot 토큰 생성 실패", e);
            return ResponseEntity.status(500)
                    .body(Map.of("message", "Bot 토큰 생성 실패: " + e.getMessage()));
        }
    }

    /**
     * 현재 Bot 토큰 조회
     *
     * @return 현재 Redis에 저장된 Bot 토큰
     */
    @GetMapping("/bot-token")
    public ResponseEntity<Map<String, String>> getCurrentBotToken() {
        log.info("현재 Bot 토큰 조회 API 호출");

        String currentToken = botTokenService.getCurrentBotToken();

        if (currentToken == null) {
            return ResponseEntity.ok(Map.of("message", "Bot 토큰이 존재하지 않습니다"));
        }

        return ResponseEntity.ok(Map.of(
                "botToken", currentToken,
                "message", "현재 Bot 토큰"
        ));
    }

    /**
     * Bot 토큰 삭제
     */
    @DeleteMapping("/bot-token")
    public ResponseEntity<Map<String, String>> deleteBotToken() {
        log.info("Bot 토큰 삭제 API 호출");

        try {
            botTokenService.deleteBotToken();

            return ResponseEntity.ok(Map.of("message", "Bot 토큰 삭제 완료"));

        } catch (Exception e) {
            log.error("Bot 토큰 삭제 실패", e);
            return ResponseEntity.status(500)
                    .body(Map.of("message", "Bot 토큰 삭제 실패: " + e.getMessage()));
        }
    }
}
