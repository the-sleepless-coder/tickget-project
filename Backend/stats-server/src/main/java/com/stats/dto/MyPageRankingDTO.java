package com.stats.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import lombok.*;
import lombok.extern.slf4j.Slf4j;

import java.util.List;

@Slf4j
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class MyPageRankingDTO {
    // userId
    private Long userId;
    // userNickName
    private String userNickName;
    // 시즌 정보
    private String seasonInfo;
    // 평균 상위 %( 소수 둘째자리 )
    private Float avgPercentile;

    // 사용자 날짜별 데이터
    @JsonUnwrapped
    private List<RankingPercentileDTO> percentileData;

    public static MyPageRankingDTO dtobuilder(Long userId, String userNickName, String seasonInfo, Float avgPercentile, List<RankingPercentileDTO> percentileData){
        return MyPageRankingDTO.builder()
                .userId(userId)
                .userNickName(userNickName)
                .seasonInfo(seasonInfo)
                .avgPercentile(avgPercentile)
                .percentileData(percentileData)
                .build();
    }

}
