package com.tickget.authserver.config;

import com.tickget.authserver.jwt.JwtAuthenticationFilter;
import com.tickget.authserver.oauth.CustomOAuth2UserService;
import com.tickget.authserver.oauth.OAuth2LoginSuccessHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
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
@Slf4j
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Value("${app.oauth2.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    /**
     * Public 엔드포인트용 SecurityFilterChain (우선순위 높음)
     * - Health check, Actuator, Swagger 등 인증 불필요한 경로
     * - OAuth2 설정 없음 → 리다이렉트 발생 안 함
     */
    @Bean
    @org.springframework.core.annotation.Order(1)
    public SecurityFilterChain publicSecurityFilterChain(HttpSecurity http) throws Exception {
        log.info("🔧 Configuring PUBLIC SecurityFilterChain (Order 1)");
        log.info("   Paths: /health, /actuator/**, /swagger-ui/**, /validate, /refresh, /error");

        http
                .securityMatcher(
                        "/health",
                        "/actuator/**",
                        "/swagger-ui/**",
                        "/v3/api-docs/**",
                        "/swagger-resources/**",
                        "/validate",
                        "/refresh",
                        "/error"
                )
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .authorizeHttpRequests(auth -> {
                    log.info("   🔓 Allowing ALL requests (permitAll) for public endpoints");
                    auth.anyRequest().permitAll();
                })
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        log.info("✅ PUBLIC SecurityFilterChain configured successfully");
        return http.build();
    }

    /**
     * OAuth2 로그인 및 인증 보호용 SecurityFilterChain
     * - 나머지 모든 경로 처리
     */
    @Bean
    @org.springframework.core.annotation.Order(2)
    public SecurityFilterChain authSecurityFilterChain(HttpSecurity http) throws Exception {
        log.info("🔧 Configuring AUTH SecurityFilterChain (Order 2)");
        log.info("   Paths: All other paths not matched by Order 1");
        log.info("   OAuth2 Login: ENABLED");

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
                .authorizeHttpRequests(auth -> {
                    log.info("   🔓 Permit: /, /login/**, /oauth2/**");
                    log.info("   🔒 Require Auth: /api/auth/**, anyRequest()");
                    auth
                        // OAuth2 로그인 관련 경로 모두 허용
                        .requestMatchers("/", "/login/**", "/oauth2/**").permitAll()
                        // 나머지 API는 인증 필요
                        .requestMatchers("/api/auth/**").authenticated()
                        // 나머지는 모두 인증 필요
                        .anyRequest().authenticated();
                })

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

        log.info("✅ AUTH SecurityFilterChain configured successfully");
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
}
