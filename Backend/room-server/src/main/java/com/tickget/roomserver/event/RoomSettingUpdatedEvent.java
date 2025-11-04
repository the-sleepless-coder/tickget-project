package com.tickget.roomserver.event;

import java.time.LocalDateTime;
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

    static public RoomSettingUpdatedEvent from (MatchSettingChangedEvent event){
        return RoomSettingUpdatedEvent.builder()
                .roomId(event.getRoomId())
                .matchId(event.getMatchId())
                .matchName(event.getMatchName())
                .difficulty(event.getDifficulty())
                .maxUserCount(event.getMaxUserCount())
                .startTime(event.getStartTime())
                .build();
    }
}
