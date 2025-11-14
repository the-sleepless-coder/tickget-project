package com.tickget.authserver.oauth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tickget.authserver.dto.TokenResponse;
import com.tickget.authserver.entity.User;
import com.tickget.authserver.jwt.JwtTokenProvider;
import com.tickget.authserver.repository.UserRepository;
import com.tickget.authserver.service.ProfileImageService;
import com.tickget.authserver.service.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;

/**
 * OAuth2 로그인 성공 후 JWT 토큰을 생성하고 프론트엔드로 리다이렉트
 * 개선사항:
 * - Refresh Token을 Redis에 저장
 * - 토큰을 URL 파라미터로 전달 (프론트엔드가 쿼리에서 추출 후 LocalStorage에 저장)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtTokenProvider jwtTokenProvider;
    private final TokenService tokenService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final ProfileImageService profileImageService;

    @Value("${app.oauth2.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {

        try {
            // OAuth2User에서 직접 정보 추출
            OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();

            // CustomOAuth2User인 경우
            if (oAuth2User instanceof CustomOAuth2User customUser) {
                handleCustomOAuth2User(customUser, request, response);
            }
            // 일반 OAuth2User인 경우 (DefaultOidcUser 포함)
            else {
                handleDefaultOAuth2User(oAuth2User, request, response);
            }
        } catch (Exception e) {
            log.error("OAuth2 로그인 성공 처리 중 오류 발생", e);
            response.sendRedirect(frontendUrl + "/login?error=true");
        }
    }

    /**
     * CustomOAuth2User 처리
     */
    private void handleCustomOAuth2User(CustomOAuth2User customUser,
                                        HttpServletRequest request,
                                        HttpServletResponse response) throws IOException {
        log.info("OAuth2 로그인 성공: userId={}, email={}",
                customUser.getUserId(), customUser.getEmail());

        // DB에서 사용자 조회하여 추가 정보 입력 필요 여부 확인
        User user = userRepository.findById(customUser.getUserId())
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        boolean needsAdditionalInfo = user.getName() == null;

        // JWT 토큰 생성
        String accessToken = jwtTokenProvider.createAccessToken(
                customUser.getUserId(),
                customUser.getEmail()
        );
        String refreshToken = jwtTokenProvider.createRefreshToken(customUser.getUserId());

        // Refresh Token을 Redis에 저장
        tokenService.saveRefreshToken(customUser.getUserId(), refreshToken);

        redirectToFrontend(request, response, accessToken, refreshToken,
                customUser.getUserId(), customUser.getEmail(), customUser.getNickname(), needsAdditionalInfo);
    }

    /**
     * 일반 OAuth2User 처리 (DefaultOidcUser 등)
     */
    private void handleDefaultOAuth2User(OAuth2User oAuth2User,
                                         HttpServletRequest request,
                                         HttpServletResponse response) throws IOException {
        // attributes에서 직접 추출
        String email = oAuth2User.getAttribute("email");
        String name = oAuth2User.getAttribute("name");
        String picture = oAuth2User.getAttribute("picture");

        log.info("OAuth2 로그인 성공 (DefaultOAuth2User): email={}, name={}, picture={}",
                email, name, picture);

        // DB에서 사용자 조회 또는 생성
        User user = userRepository.findByEmail(email)
                .orElseGet(() -> createNewUser(email, name, picture));

        boolean needsAdditionalInfo = user.getNickname() == null;

        // JWT 토큰 생성
        String accessToken = jwtTokenProvider.createAccessToken(user.getId(), user.getEmail());
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getId());

        // Refresh Token을 Redis에 저장
        tokenService.saveRefreshToken(user.getId(), refreshToken);

        String nickname = user.getNickname() != null ? user.getNickname() : email.split("@")[0];

        redirectToFrontend(request, response, accessToken, refreshToken,
                user.getId(), user.getEmail(), nickname, needsAdditionalInfo);
    }

    /**
     * 신규 사용자 생성
     */
    private User createNewUser(String email, String name, String picture) {
        log.info("신규 사용자 생성: email={}, name={}", email, name);

        // 1. 먼저 사용자를 저장하여 ID 생성 (프로필 이미지는 null)
        User newUser = User.builder()
                .email(email)
                .name(name)
                .nickname(null)  // 추가 정보 입력 필요
                .profileImageUrl(null)  // 일단 null로 저장
                .gender(User.Gender.UNKNOWN)
                .birthDate(null)
                .build();

        newUser = userRepository.save(newUser);

        // 2. 기본 프로필 이미지를 S3에 업로드
        try {
            String s3ProfileUrl = profileImageService.copyRandomDefaultProfileImage(newUser.getId());
            newUser.setProfileImageUrl(s3ProfileUrl);
            log.info("기본 프로필 이미지 설정 완료 - userId: {}, url: {}", newUser.getId(), s3ProfileUrl);
        } catch (Exception e) {
            log.error("기본 프로필 이미지 업로드 실패 - userId: {}, error: {}", newUser.getId(), e.getMessage());
            // 프로필 이미지 업로드 실패 시에도 사용자 생성은 계속 진행 (null로 유지)
        }

        return userRepository.save(newUser);
    }

    /**
     * 프론트엔드로 리다이렉트
     * - AccessToken: URL 파라미터 (프론트엔드가 LocalStorage에 저장)
     * - RefreshToken: HttpOnly Cookie (JavaScript 접근 불가, 보안 강화)
     */
    private void redirectToFrontend(HttpServletRequest request,
                                    HttpServletResponse response,
                                    String accessToken,
                                    String refreshToken,
                                    Long userId,
                                    String email,
                                    String nickname,
                                    boolean needsAdditionalInfo) throws IOException {

        // Refresh Token을 HttpOnly Cookie로 설정
        jakarta.servlet.http.Cookie refreshTokenCookie = new jakarta.servlet.http.Cookie("refreshToken", refreshToken);
        refreshTokenCookie.setHttpOnly(true);  // JavaScript 접근 불가
        refreshTokenCookie.setSecure(true);    // HTTPS only
        refreshTokenCookie.setPath("/");       // 모든 경로에서 전송
        refreshTokenCookie.setMaxAge(7 * 24 * 60 * 60);  // 7일
        refreshTokenCookie.setAttribute("SameSite", "Lax");  // CSRF 방지
        response.addCookie(refreshTokenCookie);

        // 추가 정보 입력이 필요한 경우 다른 경로로 리다이렉트
        String path = needsAdditionalInfo ? "/signup/additional-info" : "/login/success";

        // AccessToken만 URL 파라미터로 전달 (RefreshToken은 Cookie에 있음)
        // 한글 등 특수문자 URL 인코딩을 위해 encode() 호출
        String targetUrl = UriComponentsBuilder.fromUriString(frontendUrl + path)
                .queryParam("accessToken", accessToken)
                .queryParam("userId", userId)
                .queryParam("email", email)
                .queryParam("nickname", nickname)
                .queryParam("needsProfile", needsAdditionalInfo)
                .encode()  // ⭐ URL 인코딩 (한글 등 특수문자 처리)
                .toUriString();

        log.info("프론트엔드로 리다이렉트: path={}, userId={}, RefreshToken=Cookie", path, userId);
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}
