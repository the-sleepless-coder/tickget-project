package com.tickget.roomserver.dto.cache;

import com.tickget.roomserver.event.MatchSettingChangedEvent;
import java.time.LocalDateTime;
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
    private LocalDateTime startTime;

    static public RoomInfoUpdate from(MatchSettingChangedEvent event){
        return RoomInfoUpdate.builder()
                .matchId(event.getMatchId())
                .matchName(event.getMatchName())
                .difficulty(event.getDifficulty())
                .maxUserCount(event.getMaxUserCount())
                .startTime(event.getStartTime())
                .build();
    }
}
