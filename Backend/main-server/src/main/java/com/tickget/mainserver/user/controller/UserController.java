package com.tickget.mainserver.user.controller;

import com.tickget.mainserver.user.dto.UserProfileRequest;
import com.tickget.mainserver.user.entity.User;
import com.tickget.mainserver.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 사용자 정보 관리 REST API 컨트롤러
 */
@Slf4j
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /**
     * 사용자 추가 정보 입력/수정
     */
    @PostMapping("/profile")
    public ResponseEntity<Map<String, Object>> updateProfile(
            Authentication authentication,
            @Valid @RequestBody UserProfileRequest request) {

        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "로그인이 필요합니다."));
        }

        Long userId = (Long) authentication.getPrincipal();

        try {
            User user = userService.updateUserProfile(userId, request);

            Map<String, Object> response = new HashMap<>();
            response.put("userId", user.getId());
            response.put("email", user.getEmail());
            response.put("nickname", user.getNickname());
            response.put("name", user.getName());
            response.put("gender", user.getGender().name());
            response.put("birthDate", user.getBirthDate());
            response.put("profileImageUrl", user.getProfileImageUrl());
            response.put("message", "프로필 업데이트 성공");

            log.info("프로필 업데이트 성공: userId={}", userId);

            return ResponseEntity.ok(response);

        } catch (RuntimeException e) {
            log.error("프로필 업데이트 실패: userId={}, error={}", userId, e.getMessage());
            return ResponseEntity.badRequest()
                    .body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * 현재 사용자 정보 상세 조회
     */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMyProfile(Authentication authentication) {

        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "로그인이 필요합니다."));
        }

        Long userId = (Long) authentication.getPrincipal();
        User user = userService.getUserById(userId);

        Map<String, Object> response = new HashMap<>();
        response.put("userId", user.getId());
        response.put("email", user.getEmail());
        response.put("nickname", user.getNickname());
        response.put("name", user.getName());
        response.put("gender", user.getGender().name());
        response.put("birthDate", user.getBirthDate());
        response.put("profileImageUrl", user.getProfileImageUrl());
        response.put("phone", user.getPhone());
        response.put("address", user.getAddress());
        response.put("createdAt", user.getCreatedAt());
        response.put("updatedAt", user.getUpdatedAt());

        return ResponseEntity.ok(response);
    }
}