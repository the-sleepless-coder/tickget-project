package com.stats.dto.response;

import com.stats.entity.Match;
import com.stats.entity.Room;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MatchSpecificsStatsDTO {
    private Long matchId;
    private Integer queueMissCount;
    private Float queueSelectTime;
    private Integer captchaBackspaceCount;
    private Float captchaSelectTime;
    private Integer captchaTrialCount;
    private Float seatSelectTime;
    private Integer seatSelectCount;
    private String selectedSection;
    private String selectedSeat;
    private Integer totalRank;
    private Long userId;
    private Long hallId;
    private Room.RoomType roomType;
}

