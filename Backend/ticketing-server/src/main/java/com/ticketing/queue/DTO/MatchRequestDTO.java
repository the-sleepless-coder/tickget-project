package com.ticketing.queue.DTO;

import com.ticketing.seat.entity.Match;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class MatchDTO {

    private Long roomId;                     // 방 ID
    private String matchName;                // 경기 이름
    private Match.Difficulty difficulty;     // 난이도 (EASY, NORMAL, HARD)
    private Integer maxUser;                  // 최대 유저 수
    private Integer usedBotCount;             // 사용된 봇 수
    private LocalDateTime startedAt;                // 경기 시작 시간
    private Match.MatchStatus status;       // 경기 상태 (WAITING, PLAYING, FINISHED)
    private Integer userCount;                // 현재 유저 수
    private Integer successUserCount;         // 성공한 유저 수
    private Integer successBotCount;          // 성공한 봇 수
    private LocalDateTime endedAt;                  // 경기 종료 시간
    private Integer timeLimitSeconds;         // 제한 시간(초)
    private LocalDateTime createdAt;
    private LocalDateTime updateAt;
    
}
