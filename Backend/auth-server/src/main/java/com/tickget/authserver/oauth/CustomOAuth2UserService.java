package com.tickget.authserver.oauth;

import com.tickget.authserver.entity.User;
import com.tickget.authserver.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * Google OAuth2 사용자 정보를 처리하고 DB에 저장/조회하는 서비스
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oauth2User = super.loadUser(userRequest);

        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        Map<String, Object> attributes = oauth2User.getAttributes();

        // Google OAuth2 사용자 정보 추출
        String email = (String) attributes.get("email");
        String name = (String) attributes.get("name");
        String picture = (String) attributes.get("picture");  // 프로필 이미지 URL

        log.info("OAuth2 로그인: provider={}, email={}, name={}, picture={}",
                registrationId, email, name, picture);

        // DB에서 이메일로 사용자 조회 또는 신규 생성
        User user = userRepository.findByEmail(email)
                .orElseGet(() -> createNewUser(email, name, picture));

        // nickname이 null이면 추가 정보 입력이 필요한 상태
        String nickname = user.getNickname() != null ? user.getNickname() : email.split("@")[0];

        return new CustomOAuth2User(oauth2User, user.getId(), user.getEmail(), nickname);
    }

    private User createNewUser(String email, String name, String picture) {
        log.info("신규 사용자 생성: email={}, name={}, picture={}", email, name, picture);

        // Google OAuth2에서 받은 정보로 사용자 생성
        User newUser = User.builder()
                .email(email)
                .name(name)
                .nickname(null)  // 추가 정보 입력 필요
                .profileImageUrl(picture)  // Google 프로필 이미지 저장
                .gender(User.Gender.UNKNOWN)
                .birthDate(null)
                .build();

        return userRepository.save(newUser);
    }
}
