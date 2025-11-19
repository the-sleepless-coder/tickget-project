package com.tickget.roomserver.dto.response;

import com.tickget.roomserver.domain.entity.Room;
import com.tickget.roomserver.domain.enums.HallSize;
import com.tickget.roomserver.domain.enums.HallType;
import com.tickget.roomserver.domain.enums.RoomStatus;
import com.tickget.roomserver.domain.enums.RoomType;
import com.tickget.roomserver.domain.enums.ThumbnailType;
import java.time.LocalDateTime;

import com.tickget.roomserver.dto.cache.RoomInfo;
import com.tickget.roomserver.util.TimeConverter;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomResponse {

    private Long roomId;
    private String roomName;
    private Long hostId;
    private int botCount;
    private int maxUserCount;

    private int currentUserCount;

    private String difficulty;
    private RoomType roomType;
    private RoomStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime startTime;

    private HallSize hallSize;
    private HallType hallType;
    private String hallName;
    private int totalSeat;

    private ThumbnailType thumbnailType;
    private String thumbnailValue;

    public static RoomResponse of (Room room, RoomInfo roomInfo ){
        // startTime은 null일 수 있음
        LocalDateTime startTime = null;
        if (roomInfo.getStartTime() != null) {
            startTime = TimeConverter.toLocalDateTime(roomInfo.getStartTime());
        }

        return RoomResponse.builder()
                .roomId(room.getId())
                .roomName(roomInfo.getTitle())
                .hostId(roomInfo.getHostId())
                .botCount(room.getBotCount())
                .maxUserCount(roomInfo.getMaxUserCount())
                .currentUserCount(roomInfo.getCurrentUserCount())
                .difficulty(roomInfo.getDifficulty())
                .roomType(room.getRoomType())
                .status(room.getStatus())
                .createdAt(TimeConverter.toLocalDateTime(roomInfo.getCreatedAt()))
                .startTime(startTime)
                .hallSize(room.getHallSize())
                .hallType(room.isAIGenerated() ? HallType.AI_GENERATED : HallType.PRESET)
                .hallName(room.getHallName())
                .totalSeat(room.getTotalSeat())
                .thumbnailType(room.getThumbnailType())
                .thumbnailValue(room.getThumbnailValue())
                .build();
    }


}
