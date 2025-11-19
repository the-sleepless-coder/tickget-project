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
    private final ProfileImageService profileImageService;

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

        // 1. 테스트 유저 생성 (프로필 이미지는 null)
        User testUser = User.builder()
                .email(email)
                .nickname(nickname)
                .name(name)
                .gender(User.Gender.UNKNOWN)
                .birthDate(LocalDate.of(2000, 1, 1))  // 기본 생년월일
                .address("Geust Address")
                .phone("010-0000-0000")
                .profileImageUrl(null)  // 일단 null로 저장
                .build();

        // 2. DB에 저장하여 ID 생성
        User savedUser = userRepository.save(testUser);
        log.info("게스트 유저 생성 완료: id={}, email={}, nickname={}, name={}",
                savedUser.getId(), savedUser.getEmail(), savedUser.getNickname(), savedUser.getName());

        // 3. 기본 프로필 이미지를 S3에 업로드
        try {
            String s3ProfileUrl = profileImageService.copyRandomDefaultProfileImage(savedUser.getId());
            savedUser.setProfileImageUrl(s3ProfileUrl);
            savedUser = userRepository.save(savedUser);
            log.info("기본 프로필 이미지 설정 완료 - userId: {}, url: {}", savedUser.getId(), s3ProfileUrl);
        } catch (Exception e) {
            log.error("기본 프로필 이미지 업로드 실패 - userId: {}, error: {}", savedUser.getId(), e.getMessage());
            // 프로필 이미지 업로드 실패 시에도 사용자 생성은 계속 진행 (null로 유지)
        }

        // JWT 토큰 생성
        String accessToken = jwtTokenProvider.createAccessToken(savedUser.getId(), savedUser.getEmail());
        String refreshToken = jwtTokenProvider.createRefreshToken(savedUser.getId());

        // Refresh Token을 Redis에 저장
        tokenService.saveRefreshToken(savedUser.getId(), refreshToken);

        log.info("게스트 유저 로그인 완료: userId={}", savedUser.getId());

        return TestLoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)  // Controller에서 Cookie 설정을 위해 포함
                .userId(savedUser.getId())
                .email(savedUser.getEmail())
                .nickname(savedUser.getNickname())
                .name(savedUser.getName())
                .message("게스트 유저 생성 및 로그인 성공")
                .build();
    }

    /**
     * 유니크한 이메일 생성
     * 형식: guest-{uniqueId}@tickget.guest
     */
    private String generateUniqueEmail(String uniqueId) {
        String email;
        int attempt = 0;

        do {
            if (attempt > 0) {
                // 만약 중복이면 추가 랜덤 문자열 붙이기
                email = String.format("guest-%s-%d@tickget.guest", uniqueId, attempt);
            } else {
                email = String.format("guest-%s@tickget.guest", uniqueId);
            }
            attempt++;
        } while (userRepository.findByEmail(email).isPresent() && attempt < 10);

        return email;
    }

    /**
     * 유니크한 닉네임 생성
     * 형식: Guest_{uniqueId}
     */
    private String generateUniqueNickname(String uniqueId) {
        return String.format("Guest_%s", uniqueId);
    }

    /**
     * 유니크한 이름 생성
     * 형식: 게스트유저{uniqueId}
     */
    private String generateUniqueName(String uniqueId) {
        return String.format("게스트유저%s", uniqueId);
    }
}
