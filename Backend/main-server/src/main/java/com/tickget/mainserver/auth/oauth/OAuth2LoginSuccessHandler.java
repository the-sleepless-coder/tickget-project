package com.tickget.mainserver.auth.oauth;

import com.tickget.mainserver.auth.jwt.JwtTokenProvider;
import com.tickget.mainserver.user.entity.User;
import com.tickget.mainserver.user.repository.UserRepository;
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
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;

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

        boolean needsAdditionalInfo = user.getNickname() == null;

        // JWT 토큰 생성
        String accessToken = jwtTokenProvider.createAccessToken(
                customUser.getUserId(),
                customUser.getEmail()
        );
        String refreshToken = jwtTokenProvider.createRefreshToken(customUser.getUserId());

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

        log.info("OAuth2 로그인 성공 (DefaultOAuth2User): email={}", email);

        // DB에서 사용자 조회 또는 생성
        User user = userRepository.findByEmail(email)
                .orElseGet(() -> createNewUser(email, name));

        boolean needsAdditionalInfo = user.getNickname() == null;

        // JWT 토큰 생성
        String accessToken = jwtTokenProvider.createAccessToken(user.getId(), user.getEmail());
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getId());

        String nickname = user.getNickname() != null ? user.getNickname() : email.split("@")[0];

        redirectToFrontend(request, response, accessToken, refreshToken,
                user.getId(), user.getEmail(), nickname, needsAdditionalInfo);
    }

    /**
     * 신규 사용자 생성
     */
    private User createNewUser(String email, String name) {
        log.info("신규 사용자 생성: email={}", email);

        User newUser = User.builder()
                .email(email)
                .name(name)
                .nickname(null)  // 추가 정보 입력 필요
                .profileImageUrl(null)
                .gender(User.Gender.UNKNOWN)
                .birthDate(null)
                .build();

        return userRepository.save(newUser);
    }

    /**
     * 프론트엔드로 리다이렉트
     */
    private void redirectToFrontend(HttpServletRequest request,
                                    HttpServletResponse response,
                                    String accessToken,
                                    String refreshToken,
                                    Long userId,
                                    String email,
                                    String nickname,
                                    boolean needsAdditionalInfo) throws IOException {

        // 추가 정보 입력이 필요한 경우 다른 경로로 리다이렉트
        String path = needsAdditionalInfo ? "/signup/additional-info" : "/login/success";

        String targetUrl = UriComponentsBuilder.fromUriString(frontendUrl + path)
                .queryParam("accessToken", accessToken)
                .queryParam("refreshToken", refreshToken)
                .queryParam("userId", userId)
                .queryParam("email", email)
                .queryParam("nickname", nickname)
                .queryParam("needsProfile", needsAdditionalInfo)
                .build()
                .toUriString();

        log.info("프론트엔드로 리다이렉트: {}", targetUrl);
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}