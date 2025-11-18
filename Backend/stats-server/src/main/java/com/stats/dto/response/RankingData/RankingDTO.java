package com.stats.dto.response.RankingData;

import com.stats.entity.Match;
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
public class RankingDTO {
    // Ranking 정보
    private Long rankingId;
    private Integer points;
    private Integer rankingUser;  // r.userRank와 매칭
    // private Ranking.Grade grade;

    // User 정보
    private Long userId;
    private String nickname;

    // UserStats 정보
    private Integer userRank;
    private Integer totalRank;

    // Match 정보
    private Integer userCount;
    private Integer usedBotCount;
    private Match.Difficulty difficulty;

    // MatchStats 평균 정보
    private Float avgDateSelectTime;
    private Float avgSeccodeSelectTime;
    private Float avgSeatSelectTime;

    // MatchStats 표준편차 정보
    private Float stddevDateSelectTime;
    private Float stddevSeatSelectTime;
    private Float stddevSeccodeSelectTime;

    // 개인 UserStats 정보
    private Float userDateSelectTime;
    private Float userSeccodeSelectTime;
    private Float userSeatSelectTime;

    // 게임 성공 여부
    private Boolean isSuccess;

}
