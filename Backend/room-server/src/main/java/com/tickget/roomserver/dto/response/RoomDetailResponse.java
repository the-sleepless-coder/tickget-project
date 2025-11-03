package com.tickget.roomserver.dto.response;

import com.tickget.roomserver.domain.entity.Room;
import com.tickget.roomserver.domain.enums.HallSize;
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
    private Long hostId;
    private List<RoomMember> roomMembers;

    private String difficulty;
    private RoomType roomType;
    private RoomStatus status;
    private LocalDateTime startTime;

    private HallSize hallSize;
    private String hallName;

    private ThumbnailType thumbnailType;
    private String thumbnailValue;


    public static RoomDetailResponse of(Room room, RoomInfo roomInfo, List<RoomMember> roomMembers) {
        return RoomDetailResponse.builder()
                .roomId(room.getId())
                .roomName(roomInfo.getTitle())
                .botCount(room.getBotCount())
                .maxUserCount(roomInfo.getMaxUserCount())
                .currentUserCount(roomMembers.size())
                .hostId(roomInfo.getHostId())
                .roomMembers(roomMembers)
                .difficulty(roomInfo.getDifficulty())
                .roomType(room.getRoomType())
                .status(room.getStatus())
                .startTime(TimeConverter.toLocalDateTime(roomInfo.getStartTime()))
                .hallSize(room.getHallSize())
                .hallName(room.getHallName())
                .thumbnailType(room.getThumbnailType())
                .thumbnailValue(room.getThumbnailValue())
                .build();
    }
}
