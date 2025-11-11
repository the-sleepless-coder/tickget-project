package com.tickget.roomserver.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDequeuedEvent {
    private Long userId;
    private Long roomId;
    private Long matchId;
    private Long timestamp;

    public static UserDequeuedEvent of(Long userId, Long roomId, Long matchId) {
        return UserDequeuedEvent.builder()
                .userId(userId)
                .roomId(roomId)
                .matchId(matchId)
                .timestamp(System.currentTimeMillis())
                .build();
    }
}