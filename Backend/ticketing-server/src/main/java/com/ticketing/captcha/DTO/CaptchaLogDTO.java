package com.ticketing.captcha.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class CaptchaLogDTO {
    String eventId;
    Long matchId;
    String playerType;
    String playerId;

    private float duration;
    private int backSpaceCount;
    private int attemptCount;
}
