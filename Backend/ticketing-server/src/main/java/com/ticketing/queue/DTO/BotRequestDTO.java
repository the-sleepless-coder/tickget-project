package com.ticketing.queue.DTO;

import com.ticketing.entity.Match;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class BotRequestDTO {
    private int botCount;
    private LocalDateTime startTime;
    private String difficulty;
    private Long hallId;
}
