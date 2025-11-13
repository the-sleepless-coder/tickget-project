package com.tickget.userserver.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.tickget.userserver.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileResponse {

    private Long id;

    private String email;

    private String nickname;

    private String name;

    private String birthDate; // YYYY-MM-DD

    private String gender; // MALE, FEMALE, UNKNOWN

    private String address;

    private String phone;

    private String profileImageUrl;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime updatedAt;

    /**
     * Entity -> DTO 변환
     */
    public static UserProfileResponse from(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .name(user.getName())
                .birthDate(user.getBirthDate() != null ? user.getBirthDate().toString() : null)
                .gender(user.getGender() != null ? user.getGender().name() : null)
                .address(user.getAddress())
                .phone(user.getPhone())
                .profileImageUrl(user.getProfileImageUrl())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}