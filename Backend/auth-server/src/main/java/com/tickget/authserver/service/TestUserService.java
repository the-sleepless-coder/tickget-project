package com.tickget.authserver.service;

import com.tickget.authserver.dto.TestLoginResponse;
import com.tickget.authserver.entity.User;
import com.tickget.authserver.jwt.JwtTokenProvider;
import com.tickget.authserver.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

/**
 * 테스트 유저 생성 및 로그인 서비스
 * - 겹치지 않는 랜덤 테스트 유저를 자동으로 생성
 * - 즉시 JWT 토큰 발급하여 로그인 처리
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TestUserService {

    private final UserRepository userRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final TokenService tokenService;

    /**
     * 테스트 유저 생성 및 로그인
     * - 이름, 닉네임, 이메일은 UUID 기반으로 유니크하게 생성
     * - JWT 토큰 발급 및 Refresh Token Redis 저장
     */
    @Transactional
    public TestLoginResponse createTestUserAndLogin() {
        // 유니크한 랜덤 값 생성 (UUID의 앞 8자리 사용)
        String uniqueId = UUID.randomUUID().toString().substring(0, 8);

        // 겹치지 않는 이메일, 닉네임, 이름 생성
        String email = generateUniqueEmail(uniqueId);
        String nickname = generateUniqueNickname(uniqueId);
        String name = generateUniqueName(uniqueId);

        // 테스트 유저 생성
        User testUser = User.builder()
                .email(email)
                .nickname(nickname)
                .name(name)
                .gender(User.Gender.UNKNOWN)
                .birthDate(LocalDate.of(2000, 1, 1))  // 기본 생년월일
                .address("Test Address")
                .phone("010-0000-0000")
                .profileImageUrl(null)
                .build();

        // DB에 저장
        User savedUser = userRepository.save(testUser);
        log.info("테스트 유저 생성 완료: id={}, email={}, nickname={}, name={}",
                savedUser.getId(), savedUser.getEmail(), savedUser.getNickname(), savedUser.getName());

        // JWT 토큰 생성
        String accessToken = jwtTokenProvider.createAccessToken(savedUser.getId(), savedUser.getEmail());
        String refreshToken = jwtTokenProvider.createRefreshToken(savedUser.getId());

        // Refresh Token을 Redis에 저장
        tokenService.saveRefreshToken(savedUser.getId(), refreshToken);

        log.info("테스트 유저 로그인 완료: userId={}", savedUser.getId());

        return TestLoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)  // Controller에서 Cookie 설정을 위해 포함
                .userId(savedUser.getId())
                .email(savedUser.getEmail())
                .nickname(savedUser.getNickname())
                .name(savedUser.getName())
                .message("테스트 유저 생성 및 로그인 성공")
                .build();
    }

    /**
     * 유니크한 이메일 생성
     * 형식: test-{uniqueId}@tickget.test
     */
    private String generateUniqueEmail(String uniqueId) {
        String email;
        int attempt = 0;

        do {
            if (attempt > 0) {
                // 만약 중복이면 추가 랜덤 문자열 붙이기
                email = String.format("test-%s-%d@tickget.test", uniqueId, attempt);
            } else {
                email = String.format("test-%s@tickget.test", uniqueId);
            }
            attempt++;
        } while (userRepository.findByEmail(email).isPresent() && attempt < 10);

        return email;
    }

    /**
     * 유니크한 닉네임 생성
     * 형식: TestUser_{uniqueId}
     */
    private String generateUniqueNickname(String uniqueId) {
        return String.format("TestUser_%s", uniqueId);
    }

    /**
     * 유니크한 이름 생성
     * 형식: 테스트유저{uniqueId}
     */
    private String generateUniqueName(String uniqueId) {
        return String.format("테스트유저%s", uniqueId);
    }
}
