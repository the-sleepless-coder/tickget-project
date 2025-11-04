package com.tickget.roomserver.event;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class HostChangedEvent {
    private Long roomId;
    private String newHostId;
    private String previousHostId;
    private long timestamp;

    public static HostChangedEvent of(Long roomId, String newHostId, Long previousHostId) {
        return HostChangedEvent.builder()
                .roomId(roomId)
                .newHostId(newHostId)
                .previousHostId(String.valueOf(previousHostId))
                .timestamp(System.currentTimeMillis())
                .build();
    }
}