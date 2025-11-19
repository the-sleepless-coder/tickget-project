package com.stats.dto.response.RankingData;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Getter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class RankingWeeklyDTO {
    private String weeklyInfo;
    private List<RankingPreviewDTO> rankingData;
    private String updatedTime;
}
