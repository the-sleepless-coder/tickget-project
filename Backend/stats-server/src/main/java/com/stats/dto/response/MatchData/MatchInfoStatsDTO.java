package com.stats.dto.response.MatchData;

import com.stats.entity.Match;
import com.stats.entity.Room;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class MatchInfoStatsDTO {

    private Long matchId;
    private String matchName;        // 경기 제목
    private Room.RoomType roomType;  // 경기 타입
    private Integer userTotCount; // 참가 인원
    private String hallName;          // 콘서트장 이름/유형 (돔형 콘서트장)
    private Boolean isAIGenerated;          // 콘서트장 크기/분류 (커스텀, S/M/L 등)
    private Match.Difficulty difficulty;        // 난이도 (EASY/NORMAL/HARD)
    private Integer totalSeat;        // 총 좌석 수
    private Integer botCount;         // 봇 수
    private LocalDateTime startedAt;  // 경기 시작 시간 (날짜+시간)
    private Boolean userSuccess;          // 사용자 성공 여부

}
