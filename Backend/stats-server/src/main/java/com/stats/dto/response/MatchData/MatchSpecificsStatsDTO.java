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
    private String userNickname;
    private Long hallId;
    private Room.RoomType roomType;
    private String selectedSection;
    private String selectedSeat;

    private Integer userRank;
    private Integer userTotalRank;
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
    private String profileImageUrl;

    public Integer getQueueMissCountSafe() {
        return queueMissCount != null ? queueMissCount : 0;
    }

    public Float getQueueSelectTimeSafe() {
        if (queueSelectTime == null) {
            return 0f;
        }
        if (queueSelectTime < 0) {
            return 0f;
        }
        return queueSelectTime;
    }

    public Integer getCaptchaBackspaceCountSafe() {
        return captchaBackspaceCount != null ? captchaBackspaceCount : 0;
    }

    public Float getCaptchaSelectTimeSafe() {
        if(captchaSelectTime==null){
            return 0f;
        }
        if(captchaSelectTime < 0){
            captchaSelectTime = 0f;
        }

        return captchaSelectTime;
    }

    public Integer getCaptchaTrialCountSafe() {
        return captchaTrialCount != null ? captchaTrialCount : 0;
    }

    public Integer getSeatSelectClickMissCountSafe() {
        return seatSelectClickMissCount != null ? seatSelectClickMissCount : 0;
    }

    public Float getSeatSelectTimeSafe() {
        if(seatSelectTime==null){
            seatSelectTime = 0f;
        }
        if(seatSelectTime < 0){
            seatSelectTime = 0f;
        }

        return seatSelectTime;
    }

    public Integer getSeatSelectTrialCountSafe() {
        return seatSelectTrialCount != null ? seatSelectTrialCount : 0;
    }

}

