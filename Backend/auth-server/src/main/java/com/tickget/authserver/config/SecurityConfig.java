package com.tickget.authserver.config;

import com.tickget.authserver.jwt.JwtAuthenticationFilter;
import com.tickget.authserver.oauth.CustomOAuth2UserService;
import com.tickget.authserver.oauth.OAuth2LoginSuccessHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

/**
 * Spring Security 설정
 * - OAuth2 로그인 설정
 * - JWT 인증 설정
 * - CORS 설정
 * - MSA 환경을 위한 ForwardAuth 엔드포인트 허용
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Value("${app.oauth2.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // CSRF 비활성화 (JWT 사용)
                .csrf(AbstractHttpConfigurer::disable)

                // 세션 사용 안 함 (JWT 사용)
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                // CORS 설정
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                // 요청 권한 설정
                .authorizeHttpRequests(auth -> auth
                        // OAuth2 로그인 관련 경로 모두 허용
                        .requestMatchers("/", "/error", "/login/**", "/oauth2/**").permitAll()
                        // Swagger UI 관련 경로 허용
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-resources/**").permitAll()
                        // 헬스체크, 토큰 검증(ForwardAuth), 토큰 재발급 허용
                        .requestMatchers("/health", "/validate", "/refresh", "/actuator/**").permitAll()
                        // 나머지 API는 인증 필요
                        .requestMatchers("/api/auth/**").authenticated()
                        // 나머지는 모두 인증 필요
                        .anyRequest().authenticated()
                )

                // JWT 필터 추가
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)

                // OAuth2 로그인 설정
                .oauth2Login(oauth2 -> oauth2
                        .userInfoEndpoint(userInfo -> userInfo
                                .userService(customOAuth2UserService)
                        )
                        .successHandler(oAuth2LoginSuccessHandler)
                        .failureUrl(frontendUrl + "/login?error=true")
                );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // 프론트엔드 URL과 Swagger UI를 위한 로컬호스트 허용
        configuration.setAllowedOriginPatterns(Arrays.asList(
                frontendUrl,
                "http://localhost:*",
                "http://127.0.0.1:*",
                "https://tickget.kr",
                "https://*.tickget.kr"
        ));

        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(true);
        configuration.setExposedHeaders(Arrays.asList("Authorization", "X-User-Id", "X-User-Email"));
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    /**
     * Spring Security 필터 체인에서 특정 경로를 완전히 제외
     * - Health check, Actuator 등 공개 엔드포인트
     * - OAuth2 로그인 리다이렉트를 방지
     * - /health, /actuator/** 등은 인증/인가 로직이 전혀 필요 없음
     * - .permitAll()과 달리, 아예 보안 필터를 거치지 않음
     */
    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        return (web) -> web.ignoring()
                .requestMatchers(
                        // K8s Probe 및 수동 헬스 체크 (모든 하위 경로 포함)
                        "/health",
                        "/actuator/**", // <-- '/**' 사용

                        // 토큰 검증 및 재발급 API
                        "/validate",
                        "/refresh",

                        // Swagger UI
                        "/swagger-ui/**",
                        "/v3/api-docs/**",
                        "/swagger-resources/**",

                        // OAuth2 로그인 관련 경로
                        "/",
                        "/error",
                        "/login/**",
                        "/oauth2/**"
                );
    }
}
