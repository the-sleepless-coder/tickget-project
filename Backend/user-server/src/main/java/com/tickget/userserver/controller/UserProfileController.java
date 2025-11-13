package com.tickget.userserver.controller;

import com.tickget.userserver.dto.UserProfileResponse;
import com.tickget.userserver.dto.UserProfileUpdateRequest;
import com.tickget.userserver.server.UserProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequiredArgsConstructor
public class UserProfileController {

    private final UserProfileService userProfileService;

    /**
     * 내 프로필 조회
     * GET /myprofile
     */
    @GetMapping("/myprofile")
    public ResponseEntity<UserProfileResponse> getMyProfile(
            @RequestHeader("X-User-Id") Long userId
    ) {
        log.info("프로필 조회 요청 - userId: {}", userId);
        UserProfileResponse profile = userProfileService.getMyProfile(userId);
        return ResponseEntity.ok(profile);
    }

    /**
     * 내 프로필 수정
     * PATCH /users/myprofile
     */
    @PatchMapping("/myprofile")
    public ResponseEntity<UserProfileResponse> updateMyProfile(
            @RequestHeader("X-User-Id") Long userId,
            @Valid @RequestBody UserProfileUpdateRequest request
    ) {
        log.info("프로필 수정 요청 - userId: {}", userId);
        UserProfileResponse updatedProfile = userProfileService.updateProfile(userId, request);
        return ResponseEntity.ok(updatedProfile);
    }
}