package com.tickget.roomserver.dto.request;

import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class JoinRoomRequest {
    Long userId;
    String userName;
    String profileImageUrl;
}
