package com.tickget.roomserver.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class HostChangedEvent {
    private Long roomId;
    private String newHostId;
    private String previousHostId;
    private Long timestamp;

    public static HostChangedEvent of(Long roomId, String newHostId, Long previousHostId) {
        return HostChangedEvent.builder()
                .roomId(roomId)
                .newHostId(newHostId)
                .previousHostId(String.valueOf(previousHostId))
                .timestamp(System.currentTimeMillis())
                .build();
    }
}