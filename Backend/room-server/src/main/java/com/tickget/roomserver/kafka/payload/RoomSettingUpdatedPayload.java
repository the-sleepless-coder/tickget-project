package com.tickget.roomserver.kafka.payload;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomSettingUpdatedPayload {
    private String roomName;
    private String difficulty;
    private Integer maxUserCount;
    private Long startTime;
}