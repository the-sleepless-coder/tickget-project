package com.tickget.roomserver.event;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MatchEndedEvent {
    private Long roomId;
    private Long matchId;
    private Long timestamp;
}
