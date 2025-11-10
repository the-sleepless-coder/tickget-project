package com.tickget.roomserver.dto.request;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class JoinRoomRequest {
    Long userId;
    String userName;
}
