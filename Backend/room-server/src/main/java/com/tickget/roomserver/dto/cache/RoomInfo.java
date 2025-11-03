package com.tickget.roomserver.dto.cache;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class RoomInfo {

    private Long roomId;
    private String title;
    private String host;
    private String difficulty;
    private int maxUserCount;
    private int currentUserCount;

    // 직렬화 효율성을 위해
    private Long createdAt;
    private Long startTime;

}
