package com.tickget.roomserver.session;

import lombok.Builder;
import lombok.Getter;
import org.springframework.web.socket.WebSocketSession;

@Getter
@Builder
public class SessionInfo {
    private final String sessionId;
    private final Long userId;
    private final WebSocketSession session;
    private Long roomId;  // mutable - 방 입장/퇴장 시 변경

    public void updateRoom(Long roomId) {
        this.roomId = roomId;
    }

    public void clearRoom() {
        this.roomId = null;
    }
}