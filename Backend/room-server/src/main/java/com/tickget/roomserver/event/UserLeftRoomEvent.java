package com.tickget.roomserver.event;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserLeftRoomEvent {
    private Long userId;
    private Long roomId;
    private LocalDateTime leftAt;
    private int totalUsersInRoom;

    public static UserLeftRoomEvent of(Long userId, Long roomId, int totalUsersInRoom) {
        return UserLeftRoomEvent.builder()
                .userId(userId)
                .roomId(roomId)
                .leftAt(LocalDateTime.now())
                .totalUsersInRoom(totalUsersInRoom)
                .build();
    }
}
