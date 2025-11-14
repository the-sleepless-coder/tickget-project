package com.tickget.roomserver.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SessionCloseEvent {
    private Long userId;
    private String sessionId;
    private String targetServerId;
    private Long sessionVersion;
    private Long timestamp;

    public static SessionCloseEvent of(Long userId, String sessionId, String targetServerId, Long sessionVersion) {
        return SessionCloseEvent.builder()
                .userId(userId)
                .sessionId(sessionId)
                .targetServerId(targetServerId)
                .sessionVersion(sessionVersion)
                .timestamp(System.currentTimeMillis())
                .build();
    }
}