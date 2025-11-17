package com.stats.dto;

import com.stats.entity.MatchStats;
import com.stats.entity.UserStats;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MatchStatsAggregationDTO {

    private Long matchId;
    private MatchStats.Type type;

    private Float avgDateSelectTime;
    private Float avgDateMissCount;

    private Float avgSeccodeSelectTime;
    private Float avgSeccodeBackspaceCount;
    private Float avgSeccodeTryCount;

    private Float avgSeatSelectTime;
    private Float avgSeatSelectTryCount;
    private Float avgSeatSelectClickMissCount;

    private Integer playerCount;

    private Float stddevDateSelectTime;
    private Float stddevSeccodeSelectTime;
    private Float stddevSeatSelectTime;


    public static MatchStatsAggregationDTO dtobuilder(Long matchId, MatchStats.Type type, Float avgDateSelectTime, Float avgDateMissCount, Float avgSeccodeSelectTime, Float avgSeccodeBackspaceCount, Float avgSeccodeTryCount, Float avgSeatSelectTime, Float avgSeatSelectTryCount, Float avgSeatSelectClickMissCount, Integer playerCount,
                                                      Float stddevDateSelectTime, Float stddevSeccodeSelectTime, Float stddevSeatSelectTime
                                                      ){
        return MatchStatsAggregationDTO.builder()
                .matchId(matchId)
                .type(type)
                .avgDateSelectTime(avgDateSelectTime)
                .avgDateMissCount(avgDateMissCount)
                .avgSeccodeSelectTime(avgSeccodeSelectTime)
                .avgSeccodeBackspaceCount(avgSeccodeBackspaceCount)
                .avgSeccodeTryCount(avgSeccodeTryCount)
                .avgSeatSelectTime(avgSeatSelectTime)
                .avgSeatSelectTryCount(avgSeatSelectTryCount)
                .avgSeatSelectClickMissCount(avgSeatSelectClickMissCount)
                .playerCount(playerCount)
                .stddevDateSelectTime(stddevDateSelectTime)
                .stddevSeccodeSelectTime(stddevSeccodeSelectTime)
                .stddevSeatSelectTime(stddevSeatSelectTime)
                .build();


    }

}