package com.tickget.roomserver.dto.cache;

import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class RoomMember {
    private Long userId;
    private String username;
    private long enteredAt;
    private String profileImageUrl;
}
