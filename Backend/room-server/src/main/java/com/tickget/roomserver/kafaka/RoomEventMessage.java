package com.tickget.roomserver.kafaka;

import com.tickget.roomserver.domain.enums.EventType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomEventMessage {
    private EventType eventType;
    private Long userId;
    private Long roomId;
    private int totalUsersInRoom;
    private String message;
    private long timestamp;
}
