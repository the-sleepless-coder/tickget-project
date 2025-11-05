package com.tickget.roomserver.kafaka.payload;


import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserLeftPayload {
    private Long userId;
    private Integer totalUsersInRoom;
}
