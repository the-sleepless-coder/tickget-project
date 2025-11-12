package com.ticketing.queue.DTO.response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class BotResponseDTO {
    private boolean success;
    private String message;
    private Long matchId;
}
