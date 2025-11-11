package com.ticketing.queue.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class MatchInsertedEventDTO {
    public Long matchId;
    public Long roomId;
    public LocalDateTime startedAt;
    private int botCount;
    private String difficulty;
    private Long hallId;
}
