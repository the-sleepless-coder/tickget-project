package com.tickget.roomserver.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Builder
@Getter
@AllArgsConstructor
public class NotifyRoomLeftRequest {
    private Long roomId;
    private Long userId;

    public static NotifyRoomLeftRequest of(Long roomId, Long userId) {
        return NotifyRoomLeftRequest.builder()
                .roomId(roomId)
                .userId(userId)
                .build();
    }
}
