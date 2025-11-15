package com.stats.dto.response.MatchData;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MatchSpecificsStatsDifferenceAddedDTO {

    @JsonUnwrapped
    private MatchSpecificsStatsDTO specifics;

    private Float totalTime;

    private Float queueTimeDifference;
    private Integer queueMissCountDifference;

    private Integer captchaBackSpaceCountDifference;
    private Float captchaTimeDifference;

    private Integer seatClickMissDifference;
    private Float seatSelectTimeDifference;
    private Integer seatTrialCountDifference;

    public static MatchSpecificsStatsDifferenceAddedDTO dtobuilder(
            MatchSpecificsStatsDTO specifics,

            Float totalTime,
            Float queueTimeDifference,
            Integer queueMissCountDifference,

            Float captchaTimeDifference,
            Integer captchaBackSpaceCountDifference,

            Float seatSelectTimeDifference,
            Integer seatClickMissDifference,
            Integer seatTrialCountDifference
    ) {
        return MatchSpecificsStatsDifferenceAddedDTO.builder()
                .specifics(specifics)
                .totalTime(totalTime)
                .queueTimeDifference(queueTimeDifference)
                .queueMissCountDifference(queueMissCountDifference)
                .captchaBackSpaceCountDifference(captchaBackSpaceCountDifference)
                .captchaTimeDifference(captchaTimeDifference)
                .seatClickMissDifference(seatClickMissDifference)
                .seatSelectTimeDifference(seatSelectTimeDifference)
                .seatTrialCountDifference(seatTrialCountDifference)
                .build();
    }
}

