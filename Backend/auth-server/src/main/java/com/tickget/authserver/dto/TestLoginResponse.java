package com.tickget.authserver.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestLoginResponse {
    private String accessToken;
    private String refreshToken;  // Controller에서 Cookie 설정용 (응답 JSON에는 포함되지 않음)
    private Long userId;
    private String email;
    private String nickname;
    private String name;
    private String message;
}
