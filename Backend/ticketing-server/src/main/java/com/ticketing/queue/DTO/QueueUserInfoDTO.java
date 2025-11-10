package com.ticketing.queue.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class QueueUserInfoDTO {
    int clickMiss;
    float duration;
}
