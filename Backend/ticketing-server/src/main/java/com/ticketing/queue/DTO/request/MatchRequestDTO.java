package com.ticketing.queue.DTO.request;

import com.ticketing.entity.Match;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class MatchRequestDTO {

    private Long roomId;                     // 방 ID
    private String matchName;                // 경기 이름
    private Integer maxUserCount;                  // 최대 유저 수
    private Integer botCount;           // 사용된 봇 수
    // private Integer totalSeats;
    private Match.Difficulty difficulty;     // 난이도 (EASY, NORMAL, HARD)
    private LocalDateTime startedAt;                // 경기 시작 시간
    private Long hallId;
<<<<<<< HEAD
    private String idempotencyKey;           // 멱등성 키 (room이 생성, 재시도 중복 방지)
=======
>>>>>>> e1f44780889de7e80e679e0aad6239bb33f59795
    // private int totalSeat;

}
