package com.tickget.roomserver.kafaka.payload;

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