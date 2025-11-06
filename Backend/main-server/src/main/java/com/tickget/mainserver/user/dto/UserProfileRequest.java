package com.tickget.mainserver.user.dto;

import com.tickget.mainserver.user.entity.User;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * 사용자 추가 정보 입력 요청 DTO
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserProfileRequest {

    @NotBlank(message = "닉네임은 필수입니다.")
    @Pattern(regexp = "^[a-zA-Z0-9가-힣]{2,25}$", message = "닉네임은 2-25자의 한글, 영문, 숫자만 가능합니다.")
    private String nickname;

    private String gender;  // "MALE", "FEMALE", "UNKNOWN" (선택)

    private LocalDate birthDate;  // (선택)

    private String profileImageUrl;  // (선택)

    /**
     * gender 문자열을 Gender enum으로 변환
     */
    public User.Gender getGenderEnum() {
        if (gender == null || gender.isEmpty()) {
            return User.Gender.UNKNOWN;
        }
        try {
            return User.Gender.valueOf(gender.toUpperCase());
        } catch (IllegalArgumentException e) {
            return User.Gender.UNKNOWN;
        }
    }
}