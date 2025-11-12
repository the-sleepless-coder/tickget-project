package com.tickget.roomserver.dto.cache;

import com.tickget.roomserver.dto.request.MatchSettingUpdateRequest;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RoomInfoUpdate {
    private Long roomId;
    private Long matchId;
    private String matchName;
    private String difficulty;
    private Integer maxUserCount;
    private Long startTime;

    static public RoomInfoUpdate from(MatchSettingUpdateRequest event){
        return RoomInfoUpdate.builder()
                .roomId(event.getRoomId())
                .matchId(event.getMatchId())
                .matchName(event.getMatchName())
                .difficulty(event.getDifficulty())
                .maxUserCount(event.getMaxUserCount())
                .startTime(event.getStartTime())
                .build();
    }
}
