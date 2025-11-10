package com.tickget.authserver.dto;

import com.tickget.authserver.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 사용자 정보 응답 DTO
 * GET /api/auth/me 에서 사용
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserResponse {

    private Long userId;
    private String email;
    private String nickname;
    private String name;
    private LocalDate birthDate;
    private String gender;
    private String address;
    private String phone;
    private String profileImageUrl;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /**
     * User 엔티티 → UserResponse DTO 변환
     */
    public static UserResponse from(User user) {
        return UserResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .name(user.getName())
                .birthDate(user.getBirthDate())
                .gender(user.getGender() != null ? user.getGender().name() : null)
                .address(user.getAddress())
                .phone(user.getPhone())
                .profileImageUrl(user.getProfileImageUrl())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
