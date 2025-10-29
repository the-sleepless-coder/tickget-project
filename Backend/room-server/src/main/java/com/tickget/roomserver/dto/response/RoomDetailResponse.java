package com.tickget.roomserver.dto.response;

import com.tickget.roomserver.domain.entity.Room;
import com.tickget.roomserver.domain.enums.HallSize;
import com.tickget.roomserver.domain.enums.RoomStatus;
import com.tickget.roomserver.domain.enums.RoomType;
import com.tickget.roomserver.domain.enums.ThumbnailType;
import java.time.LocalDateTime;
import java.util.List;
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
    private List<String> users;

    private String difficulty;
    private RoomType roomType;
    private RoomStatus status;
    private LocalDateTime startTime;

    private HallSize hallSize;
    private String hallName;

    private ThumbnailType thumbnailType;
    private String thumbnailValue;

    public static RoomDetailResponse of (Room room, MatchResponse matchResponse, int currentUserCount, List<String> users ){
        return RoomDetailResponse.builder()
                .roomId(room.getId())
                .roomName(matchResponse.getMatchTitle())
                .botCount(room.getBotCount())
                .maxUserCount(matchResponse.getMaxUserCount())
                .currentUserCount(currentUserCount)
                .users(users)
                .difficulty(matchResponse.getDifficulty())
                .roomType(room.getRoomType())
                .status(room.getStatus())
                .startTime(matchResponse.getStartTime())
                .hallSize(room.getHallSize())
                .hallName(room.getHallName())
                .thumbnailType(room.getThumbnailType())
                .thumbnailValue(room.getThumbnailValue())
                .build();
    }
}
