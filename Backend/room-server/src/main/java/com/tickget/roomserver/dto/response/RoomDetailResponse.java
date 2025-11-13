package com.tickget.roomserver.dto.response;

import com.tickget.roomserver.domain.entity.Room;
import com.tickget.roomserver.domain.enums.HallSize;
import com.tickget.roomserver.domain.enums.HallType;
import com.tickget.roomserver.domain.enums.RoomStatus;
import com.tickget.roomserver.domain.enums.RoomType;
import com.tickget.roomserver.domain.enums.ThumbnailType;
import java.time.LocalDateTime;
import java.util.List;

import com.tickget.roomserver.dto.cache.RoomInfo;
import com.tickget.roomserver.dto.cache.RoomMember;
import com.tickget.roomserver.util.TimeConverter;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomDetailResponse {

    private Long roomId;
    private String roomName;
    private int botCount;
    private int maxUserCount;
    private int currentUserCount;
    private int totalSeat;
    private Long hostId;
    private List<RoomMember> roomMembers;

    private String difficulty;
    private RoomType roomType;
    private RoomStatus status;
    private LocalDateTime startTime;

    private Long hallId;
    private HallSize hallSize;
    private HallType hallType;
    private String hallName;

    private ThumbnailType thumbnailType;
    private String thumbnailValue;
    private String tsxUrl;


    public static RoomDetailResponse of(Room room, RoomInfo roomInfo, List<RoomMember> roomMembers) {
        // startTime은 null일 수 있음
        LocalDateTime startTime = null;
        if (roomInfo.getStartTime() != null) {
            startTime = TimeConverter.toLocalDateTime(roomInfo.getStartTime());
        }

        return RoomDetailResponse.builder()
                .roomId(room.getId())
                .roomName(roomInfo.getTitle())
                .totalSeat(room.getTotalSeat())
                .botCount(room.getBotCount())
                .maxUserCount(roomInfo.getMaxUserCount())
                .currentUserCount(roomMembers.size())
                .hostId(roomInfo.getHostId())
                .roomMembers(roomMembers)
                .difficulty(roomInfo.getDifficulty())
                .roomType(room.getRoomType())
                .status(room.getStatus())
                .startTime(startTime)
                .hallId(room.getHallId())
                .hallSize(room.getHallSize())
                .hallType(room.isAIGenerated() ? HallType.AI_GENERATED : HallType.PRESET)
                .hallName(room.getHallName())
                .thumbnailType(room.getThumbnailType())
                .thumbnailValue(room.getThumbnailValue())
                .tsxUrl(room.getTsxUrl())
                .build();
    }
}
