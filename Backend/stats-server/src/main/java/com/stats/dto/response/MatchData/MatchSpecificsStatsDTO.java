package com.stats.dto.response.MatchData;

import com.stats.entity.Room;
import lombok.*;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@ToString
public class MatchSpecificsStatsDTO {
    private Long userId;
    private String userName;
    private Long hallId;
    private Room.RoomType roomType;
    private String selectedSection;
    private String selectedSeat;

    private Integer totalRank;
    private Room.HallSize hallSize;
    private String tsxUrl;

    private Long matchId;
    private Integer queueMissCount;
    private Float queueSelectTime;
    private Integer captchaBackspaceCount;
    private Float captchaSelectTime;
    private Integer captchaTrialCount;
    private Integer seatSelectClickMissCount;
    private Float seatSelectTime;
    private Integer seatSelectTrialCount;

    public Integer getQueueMissCountSafe() {
        return queueMissCount != null ? queueMissCount : 0;
    }

    public Float getQueueSelectTimeSafe() {
        return queueSelectTime != null ? queueSelectTime : 0f;
    }

    public Integer getCaptchaBackspaceCountSafe() {
        return captchaBackspaceCount != null ? captchaBackspaceCount : 0;
    }

    public Float getCaptchaSelectTimeSafe() {
        return captchaSelectTime != null ? captchaSelectTime : 0f;
    }

    public Integer getCaptchaTrialCountSafe() {
        return captchaTrialCount != null ? captchaTrialCount : 0;
    }

    public Integer getSeatSelectClickMissCountSafe() {
        return seatSelectClickMissCount != null ? seatSelectClickMissCount : 0;
    }

    public Float getSeatSelectTimeSafe() {
        return seatSelectTime != null ? seatSelectTime : 0f;
    }

    public Integer getSeatSelectTrialCountSafe() {
        return seatSelectTrialCount != null ? seatSelectTrialCount : 0;
    }

}

