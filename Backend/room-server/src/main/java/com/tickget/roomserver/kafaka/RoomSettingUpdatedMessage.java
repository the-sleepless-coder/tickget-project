package com.tickget.roomserver.kafaka;

import com.tickget.roomserver.domain.enums.EventType;
import com.tickget.roomserver.event.RoomSettingUpdatedEvent;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomSettingUpdatedMessage {
    private EventType eventType = EventType.ROOM_SETTING_UPDATED;
    private Long roomId;
    private String message;

    private String roomName;
    private String difficulty;
    private Integer maxUserCount;
    private Long startTime;

    static public RoomSettingUpdatedMessage from (RoomSettingUpdatedEvent roomSettingUpdatedEvent) {
        return RoomSettingUpdatedMessage.builder()
                .roomId(roomSettingUpdatedEvent.getRoomId())
                .message("방 설정이 변경되었습니다.")
                .roomName(roomSettingUpdatedEvent.getMatchName())
                .difficulty(roomSettingUpdatedEvent.getDifficulty())
                .maxUserCount(roomSettingUpdatedEvent.getMaxUserCount())
                .startTime(roomSettingUpdatedEvent.getStartTime())
                .build();
    }


}
