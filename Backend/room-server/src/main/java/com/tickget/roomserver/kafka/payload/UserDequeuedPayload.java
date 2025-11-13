package com.tickget.roomserver.kafka.payload;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDequeuedPayload {
    private Long userId;
    private Long matchId;
    private Long timestamp;
}