package com.ticketing.captcha.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class CaptchaDTO {

    private String input;
    private String captchaId;
    private Float duration;
    private Integer backSpaceCount;
    private Integer attemptCount;
    private Long matchId;

}
