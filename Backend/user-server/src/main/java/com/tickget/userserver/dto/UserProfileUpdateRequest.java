package com.tickget.userserver.dto;

import com.tickget.userserver.entity.User;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileUpdateRequest {

    @Size(max = 25, message = "닉네임은 최대 25자까지 입력 가능합니다.")
    private String nickname;

    @Size(max = 25, message = "이름은 최대 25자까지 입력 가능합니다.")
    private String name;

    @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$", message = "생년월일은 YYYY-MM-DD 형식이어야 합니다.")
    private String birthDate;

    @Pattern(regexp = "^(MALE|FEMALE|UNKNOWN)$", message = "유효하지 않은 성별 값입니다. (MALE, FEMALE, UNKNOWN 중 하나여야 합니다)")
    private String gender;

    @Size(max = 255, message = "주소는 최대 255자까지 입력 가능합니다.")
    private String address;

    @Size(max = 13, message = "전화번호는 최대 13자까지 입력 가능합니다.")
    private String phone;

//    @Size(max = 500, message = "프로필 이미지 URL은 최대 500자까지 입력 가능합니다.")
//    private String profileImageUrl;
}