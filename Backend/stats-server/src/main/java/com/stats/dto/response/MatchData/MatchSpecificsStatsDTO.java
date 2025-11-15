package com.stats.dto.response.MatchData;

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
    private Long userId;
    private String userName;
    private Long hallId;
    private Room.RoomType roomType;
    private String selectedSection;
    private String selectedSeat;

    private Long matchId;
    private Integer queueMissCount;
    private Float queueSelectTime;
    private Integer captchaBackspaceCount;
    private Float captchaSelectTime;
    private Integer captchaTrialCount;
    private Integer seatSelectClickMissCount;
    private Float seatSelectTime;
    private Integer seatSelectTrialCount;
    private Integer totalRank;

}

