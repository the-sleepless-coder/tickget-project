package com.tickget.roomserver.dto.request;


import com.tickget.roomserver.domain.enums.Difficulty;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class CreateMatchRequest {
    private Long roomId;
    private String matchName;

    private int maxUserCount;
    private int botCount;

    private Difficulty difficulty;
    private LocalDateTime startTime;


    public static CreateMatchRequest of(CreateRoomRequest request, Long roomId) {
        return CreateMatchRequest.builder()
                .roomId(roomId)
                .matchName(request.getMatchName())
                .maxUserCount(request.getMaxUserCount())
                .botCount(request.getBotCount())
                .difficulty(request.getDifficulty())
                .startTime(LocalDateTime.now())
                .build();
    }
}
