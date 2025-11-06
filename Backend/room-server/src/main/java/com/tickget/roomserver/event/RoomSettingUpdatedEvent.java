package com.tickget.roomserver.event;

import com.tickget.roomserver.dto.request.MatchSettingUpdateRequest;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RoomSettingUpdatedEvent {
    private Long roomId;
    private Long matchId;
    private String matchName;
    private String difficulty;
    private Integer maxUserCount;
    private Long startTime;

    static public RoomSettingUpdatedEvent from (MatchSettingUpdateRequest request){
        return RoomSettingUpdatedEvent.builder()
                .roomId(request.getRoomId())
                .matchId(request.getMatchId())
                .matchName(request.getMatchName())
                .difficulty(request.getDifficulty())
                .maxUserCount(request.getMaxUserCount())
                .startTime(request.getStartTime())
                .build();
    }
}
