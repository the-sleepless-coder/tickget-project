package com.tickget.authserver.controller;

import com.tickget.authserver.dto.TestLoginResponse;
import com.tickget.authserver.service.TestUserService;
import com.tickget.authserver.service.TokenService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 테스트용 API 컨트롤러
 * - 테스트 유저 자동 생성 및 로그인
 */
@Slf4j
@RestController
@RequestMapping("/test")
@RequiredArgsConstructor
public class TestController {

    private final TestUserService testUserService;

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
        log.info("테스트 유저 생성 및 로그인 API 호출");

        try {
            // 테스트 유저 생성 및 로그인 처리
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

            log.info("테스트 유저 생성 및 로그인 성공: userId={}, email={}, nickname={}",
                    response.getUserId(), response.getEmail(), response.getNickname());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("테스트 유저 생성 실패", e);
            return ResponseEntity.status(500)
                    .body(TestLoginResponse.builder()
                            .message("테스트 유저 생성 실패: " + e.getMessage())
                            .build());
        }
    }
}
