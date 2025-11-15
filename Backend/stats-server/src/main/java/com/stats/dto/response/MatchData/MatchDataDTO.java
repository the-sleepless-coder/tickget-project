package com.stats.dto.response.MatchData;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MatchDataDTO {
    MatchInfoStatsDTO matchInfo;
    // List<MatchSpecificsStatsDTO> specifics;
    List<MatchSpecificsStatsDifferenceAddedDTO> specifics;


//    public static MatchDataDTO dtobuilder(MatchInfoStatsDTO matchinfo, List<MatchSpecificsStatsDTO> specifics){
//
//        return MatchDataDTO.builder()
//                .matchInfo(matchinfo)
//                .specifics(specifics)
//                .build();
//
//    }

        public static MatchDataDTO dtobuilder(MatchInfoStatsDTO matchinfo, List<MatchSpecificsStatsDifferenceAddedDTO> specifics){

        return MatchDataDTO.builder()
                .matchInfo(matchinfo)
                .specifics(specifics)
                .build();

    }


}
