package com.ticketing.queue.DTO;

import com.ticketing.entity.Match;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchStartDTO {
    // MatchStart 여부 확인
    Long roomId;
    Long matchId;
    LocalDateTime startedAt;
    Match.MatchStatus status;
    LocalDateTime timestamp;

    public MatchStartDTO build (Long roomId, Long matchId, LocalDateTime startsAt, Match.MatchStatus status, LocalDateTime timestamp){
        return MatchStartDTO.builder()
                .roomId(roomId)
                .matchId(matchId)
                .startedAt(startsAt)
                .status(status)
                .timestamp(timestamp)
                .build();
    }
}
