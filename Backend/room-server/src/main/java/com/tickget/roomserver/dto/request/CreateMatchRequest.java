package com.tickget.roomserver.dto.request;


import com.tickget.roomserver.domain.enums.Difficulty;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class CreateMatchRequest {
    private Long roomId;
    private String matchName;

    private int maxUserCount;
    private int botCount;

    private Difficulty difficulty;
    private LocalDateTime startTime;


}
