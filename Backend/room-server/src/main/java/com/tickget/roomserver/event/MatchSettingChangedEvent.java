package com.tickget.roomserver.event;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MatchSettingChangedEvent {
    private Long roomId;
    private Long matchId;
    private String matchName;
    private String difficulty;
    private Integer maxUserCount;
    private Long startTime;

}
