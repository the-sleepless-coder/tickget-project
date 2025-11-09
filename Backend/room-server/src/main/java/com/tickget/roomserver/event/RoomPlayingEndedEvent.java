package com.tickget.roomserver.event;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RoomPlayingEndedEvent {
    private Long roomId;
}
