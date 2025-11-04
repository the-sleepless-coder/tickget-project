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
public class UserJoinedRoomEvent {
    private Long userId;
    private Long roomId;
    private LocalDateTime joinedAt;
    private int totalUsersInRoom;

    public static UserJoinedRoomEvent of(Long userId, Long roomId, int totalUsersInRoom) {
        return UserJoinedRoomEvent.builder()
                .userId(userId)
                .roomId(roomId)
                .joinedAt(LocalDateTime.now())
                .totalUsersInRoom(totalUsersInRoom)
                .build();
    }
}
