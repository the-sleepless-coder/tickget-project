package com.tickget.roomserver.dto.response;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MatchResponse {
    private Long matchId;

    private Long roomId;
    private String matchName;
    private int maxUserCount;

    private String difficulty;
    private LocalDateTime startTime;

}
