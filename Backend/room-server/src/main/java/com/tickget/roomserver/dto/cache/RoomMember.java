package com.tickget.roomserver.dto.cache;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class RoomMember {
    private Long userId;
    private String username;
    private long enteredAt;
}
