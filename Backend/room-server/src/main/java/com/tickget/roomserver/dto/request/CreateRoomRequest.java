package com.tickget.roomserver.dto.request;

import com.tickget.roomserver.domain.enums.Difficulty;
import com.tickget.roomserver.domain.enums.HallType;
import com.tickget.roomserver.domain.enums.RoomType;
import com.tickget.roomserver.domain.enums.ThumbnailType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class CreateRoomRequest {

    private Long userId;
    private String username;

    private String matchName;

    private RoomType roomType;

    private Long hallId;
    private HallType hallType;
    private Difficulty difficulty;
    
    private Boolean isAiGenerated;

    private int maxUserCount;
    private int botCount;

    private int totalSeat;

    private LocalDate reservationDay;
    private LocalDateTime gameStartTime;

    private ThumbnailType thumbnailType;
    private String thumbnailValue;
}
