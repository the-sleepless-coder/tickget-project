package com.tickget.userserver.controller;

import com.tickget.userserver.server.MinioService;
import com.tickget.userserver.server.UserProfileService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
public class ProfileImageController {

    private final MinioService minioService;
    private final UserProfileService userProfileService;

    /**
     * 프로필 이미지 업로드
     * POST /profile-image
     */
    @PostMapping(value = "/profile-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadProfileImage(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam("file") MultipartFile file
    ) {
        log.info("프로필 이미지 업로드 요청 - userId: {}, filename: {}", userId, file.getOriginalFilename());

        // 파일 유효성 검증
        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "BAD_REQUEST", "message", "파일이 비어있습니다."));
        }

        // 이미지 파일 타입 검증
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "BAD_REQUEST", "message", "이미지 파일만 업로드 가능합니다."));
        }

        // MinIO에 업로드
        String imageUrl = minioService.uploadProfileImage(userId, file);

        // DB에 이미지 URL 업데이트
        userProfileService.updateProfileImageUrl(userId, imageUrl);

        log.info("프로필 이미지 업로드 완료 - userId: {}, imageUrl: {}", userId, imageUrl);

        return ResponseEntity.ok(Map.of(
                "profileImageUrl", imageUrl,
                "message", "프로필 이미지가 업로드되었습니다."
        ));
    }

    /**
     * 프로필 이미지 삭제
     * DELETE /profile-image
     */
    @DeleteMapping("/profile-image")
    public ResponseEntity<Map<String, String>> deleteProfileImage(
            @RequestHeader("X-User-Id") Long userId
    ) {
        log.info("프로필 이미지 삭제 요청 - userId: {}", userId);

        // MinIO에서 삭제
        minioService.deleteProfileImage(userId);

        // DB에서 이미지 URL 제거
        userProfileService.updateProfileImageUrl(userId, null);

        log.info("프로필 이미지 삭제 완료 - userId: {}", userId);

        return ResponseEntity.ok(Map.of(
                "message", "프로필 이미지가 삭제되었습니다."
        ));
    }
}