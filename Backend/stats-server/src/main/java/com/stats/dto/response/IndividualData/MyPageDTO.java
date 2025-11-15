package com.stats.dto.response.IndividualData;

import lombok.*;

import java.util.List;


@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MyPageDTO {
    private Long userId;
    private ClickStatsDTO clickStats;
    private List<SpecificStatsDTO> specificsList;

    public static MyPageDTO dtobuilder(Long userId, ClickStatsDTO clickstats, List<SpecificStatsDTO> specificsList){

        return MyPageDTO.builder()
                .userId(userId)
                .clickStats(clickstats)
                .specificsList(specificsList)
                .build();
    }

}

