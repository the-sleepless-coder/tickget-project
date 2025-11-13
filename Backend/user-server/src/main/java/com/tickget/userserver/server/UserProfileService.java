package com.tickget.userserver.server;

import com.tickget.userserver.dto.UserProfileResponse;
import com.tickget.userserver.dto.UserProfileUpdateRequest;
import com.tickget.userserver.entity.User;
import com.tickget.userserver.exception.NicknameConflictException;
import com.tickget.userserver.exception.UserNotFoundException;
import com.tickget.userserver.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserProfileService {

    private final UserRepository userRepository;

    /**
     * 사용자 프로필 조회
     */
    public UserProfileResponse getMyProfile(Long userId) {
        log.info("사용자 프로필 조회 - userId: {}", userId);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("사용자를 찾을 수 없습니다."));

        return UserProfileResponse.from(user);
    }

    /**
     * 사용자 프로필 수정
     */
    @Transactional
    public UserProfileResponse updateProfile(Long userId, UserProfileUpdateRequest request) {
        log.info("사용자 프로필 수정 - userId: {}", userId);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("사용자를 찾을 수 없습니다."));

        // 닉네임 수정 시 중복 체크
        if (request.getNickname() != null && !request.getNickname().equals(user.getNickname())) {
            if (userRepository.existsByNickname(request.getNickname())) {
                throw new NicknameConflictException("이미 사용 중인 닉네임입니다.");
            }
            user.setNickname(request.getNickname());
        }

        // 나머지 필드 업데이트 (null이 아닌 경우만)
        if (request.getName() != null) {
            user.setName(request.getName());
        }
        if (request.getGender() != null) {
            user.setGender(User.Gender.valueOf(request.getGender()));
        }
        if (request.getAddress() != null) {
            user.setAddress(request.getAddress());
        }
        if (request.getPhone() != null) {
            user.setPhone(request.getPhone());
        }
//        if (request.getProfileImageUrl() != null) {
//            user.setProfileImageUrl(request.getProfileImageUrl());
//        }

        User savedUser = userRepository.save(user);

        log.info("사용자 프로필 수정 완료 - userId: {}", userId);

        return UserProfileResponse.from(savedUser);
    }

    /**
     * 프로필 이미지 URL 업데이트 (MinIO 업로드 후 호출)
     */
    @Transactional
    public void updateProfileImageUrl(Long userId, String imageUrl) {
        log.info("프로필 이미지 URL 업데이트 - userId: {}, imageUrl: {}", userId, imageUrl);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("사용자를 찾을 수 없습니다."));

        user.setProfileImageUrl(imageUrl);
        userRepository.save(user);
    }
}