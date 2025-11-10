package com.ticketing.queue.DTO.response;

import com.ticketing.entity.Match;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class MatchIdResponseDTO {
    private Long roomId;
    private Long matchId;
    private Match.MatchStatus status;
}
