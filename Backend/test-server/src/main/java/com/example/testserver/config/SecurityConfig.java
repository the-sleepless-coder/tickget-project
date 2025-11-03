// src/main/java/com/example/testserver/config/SecurityConfig.java

package com.example.testserver.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .authorizeHttpRequests(auth -> auth
                        // [수정] 모든 경로("/**")를 인증 없이 허용
                        .requestMatchers("/**").permitAll()
                )
                // [수정] Basic Auth 로그인 팝업 비활성화
                .httpBasic(AbstractHttpConfigurer::disable)
                // CSRF 보호 비활성화 (테스트용)
                .csrf(AbstractHttpConfigurer::disable);

        return http.build();
    }
}