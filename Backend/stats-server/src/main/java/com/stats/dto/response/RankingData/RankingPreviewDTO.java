package com.stats.dto.response.RankingData;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Getter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class RankingPreviewDTO {
    private int rank;
    private Long userId;
    private String nickName;
    private String imageUrl;
    private int points;
}
