package com.tickget.authserver.service;

import com.tickget.authserver.dto.TestLoginResponse;
import com.tickget.authserver.entity.User;
import com.tickget.authserver.jwt.JwtTokenProvider;
import com.tickget.authserver.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 로그인 서비스
 * - 사전에 DB에 등록된 관리자 계정으로 로그인
 * - 30일 유효기간의 Access Token 발급
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final TokenService tokenService;

    /**
     * 관리자 닉네임으로 로그인
     * - 이미 DB에 존재하는 관리자 계정으로 로그인
     * - 30일 유효기간의 JWT Access Token 발급
     * - Refresh Token도 발급하지만 주로 Access Token 사용
     */
    @Transactional(readOnly = true)
    public TestLoginResponse loginAsAdmin(String nickname) {
        // 관리자 계정 조회 (nickname으로 검색)
        User admin = userRepository.findByNickname(nickname)
                .orElseThrow(() -> new RuntimeException("관리자 계정을 찾을 수 없습니다: " + nickname));

        log.info("관리자 로그인: id={}, email={}, nickname={}, name={}",
                admin.getId(), admin.getEmail(), admin.getNickname(), admin.getName());

        // 관리자용 JWT 토큰 생성 (30일)
        String accessToken = jwtTokenProvider.createAdminAccessToken(admin.getId(), admin.getEmail());
        String refreshToken = jwtTokenProvider.createRefreshToken(admin.getId());

        // Refresh Token을 Redis에 저장
        tokenService.saveRefreshToken(admin.getId(), refreshToken);

        log.info("관리자 로그인 완료: userId={}, nickname={}, 토큰 유효기간=30일", admin.getId(), nickname);

        return TestLoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)  // Controller에서 Cookie 설정을 위해 포함
                .userId(admin.getId())
                .email(admin.getEmail())
                .nickname(admin.getNickname())
                .name(admin.getName())
                .message("관리자 로그인 성공 (토큰 유효기간: 30일)")
                .build();
    }
}
