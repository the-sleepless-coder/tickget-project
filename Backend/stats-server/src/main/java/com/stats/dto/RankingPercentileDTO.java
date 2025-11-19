package com.stats.dto;

import lombok.*;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class RankingPercentileDTO {

    // snapShotAt 특정 날짜 포멧
    private String dateInfo;
    // userRank / totalPlayer -> 상위 % (둘째 짜리)
    private Float percentile;
    // points
    private Integer points;

    public static RankingPercentileDTO dtobuilder(String dateInfo, Float percentile, Integer points){
        return RankingPercentileDTO.builder()
                .dateInfo(dateInfo)
                .percentile(percentile)
                .points(points)
                .build();
    }
}
