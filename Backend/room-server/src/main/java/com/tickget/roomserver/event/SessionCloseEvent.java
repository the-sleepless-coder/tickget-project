package com.tickget.roomserver.event;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SessionCloseEvent {
    private Long userId;
    private String sessionId;
    private String targetServerId;
    private Long timestamp;

    public static SessionCloseEvent of(Long userId, String sessionId, String targetServerId) {
        return SessionCloseEvent.builder()
                .userId(userId)
                .sessionId(sessionId)
                .targetServerId(targetServerId)
                .timestamp(System.currentTimeMillis())
                .build();
    }
}