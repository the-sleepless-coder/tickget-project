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
    private Long hallId;
    private String matchName;

    private int maxUserCount;
    private int botCount;

    private Difficulty difficulty;
    private LocalDateTime startedAt;


    public static CreateMatchRequest of(CreateRoomRequest request, Long roomId) {
        return CreateMatchRequest.builder()
                .roomId(roomId)
                .hallId(request.getHallId())
                .matchName(request.getMatchName())
                .maxUserCount(request.getMaxUserCount())
                .botCount(request.getBotCount())
                .difficulty(request.getDifficulty())
                .startedAt(request.getGameStartTime())
                .build();
    }
}
