package com.ticketing.queue.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class MatchResponseDTO {
    private Long Id;
    private Long roomId;
    private String matchName;
    private Integer maxUserCount;
    private String difficulty;
    private LocalDateTime startTime;
}
