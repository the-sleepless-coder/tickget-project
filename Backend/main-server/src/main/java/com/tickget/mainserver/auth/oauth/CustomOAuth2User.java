package com.tickget.mainserver.auth.oauth;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Collection;
import java.util.Map;

/**
 * OAuth2 인증 후 사용자 정보를 담는 커스텀 객체
 */
@Getter
public class CustomOAuth2User implements OAuth2User {

    private final OAuth2User oauth2User;
    private final Long userId;
    private final String email;
    private final String nickname;

    public CustomOAuth2User(OAuth2User oauth2User, Long userId, String email, String nickname) {
        this.oauth2User = oauth2User;
        this.userId = userId;
        this.email = email;
        this.nickname = nickname;
    }

    @Override
    public Map<String, Object> getAttributes() {
        return oauth2User.getAttributes();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return oauth2User.getAuthorities();
    }

    @Override
    public String getName() {
        return oauth2User.getName();
    }
}