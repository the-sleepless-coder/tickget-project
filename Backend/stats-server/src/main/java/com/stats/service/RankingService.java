package com.stats.service;

import com.stats.dto.response.RankingData.RankingDTO;
import com.stats.entity.Match;
import com.stats.repository.MatchStatsRepository;
import com.stats.repository.RankingRepository;
import com.stats.repository.UserStatsRepository;
import com.stats.util.RoundBy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.List;
import static java.lang.Math.log;
import com.stats.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class RankingService {
    private final RankingRepository rankingRepository;
    private final UserStatsRepository userStatsRepository;
    private final MatchStatsRepository matchStatsRepository;

    private static final int BOT_BASE_SCORE = 1000;
    private static final int USER_BASE_SCORE = 500;
    private static final double BASE_LOG = 10000.0;
    private static final float PEOPLE_FACTOR_MAX = 0.3f;

    // Match 내 플레이어에 대한 랭킹 집계
    public Object calculateRanking(Long matchIdLong){
        List<RankingDTO> givenMatchData = rankingRepository.findRankingByMatchId(matchIdLong);

        // Data 자체가 집계 안됨.
        if(givenMatchData.isEmpty()){
           log.info("no data");
            return null;
        }


        // Match별 평균, 표준편차 데이터 찾기
        Float avgQueueTime = -100f;
        Float avgCaptchaTime = -100f;
        Float avgSeatTime = -100f;
        Float stddevQueueTime = -100f;
        Float stddevCaptchaTime = -100f;
        Float stddevSeatTime = -100f;
        for(RankingDTO singleData: givenMatchData){
            avgQueueTime = singleData.getAvgDateSelectTime();
            avgCaptchaTime = singleData.getAvgSeccodeSelectTime();
            avgSeatTime = singleData.getAvgSeatSelectTime();

            stddevQueueTime = singleData.getStddevDateSelectTime();
            stddevCaptchaTime = singleData.getStddevSeccodeSelectTime();
            stddevSeatTime = singleData.getStddevSeatSelectTime();

            boolean missing = false;

            if (avgQueueTime == null) {
                log.warn("Missing avgQueueTime for matchId={}", singleData.getAvgDateSelectTime());
                missing = true;
            }
            if (avgCaptchaTime == null) {
                log.warn("Missing avgCaptchaTime for matchId={}", singleData.getAvgSeccodeSelectTime());
                missing = true;
            }
            if (avgSeatTime == null) {
                log.warn("Missing avgSeatTime for matchId={}", singleData.getAvgSeatSelectTime());
                missing = true;
            }

            if (stddevQueueTime == null) {
                log.warn("Missing stddevQueueTime for matchId={}", singleData.getStddevDateSelectTime());
                missing = true;
            }
            if (stddevCaptchaTime == null) {
                log.warn("Missing stddevCaptchaTime for matchId={}", singleData.getStddevSeccodeSelectTime());
                missing = true;
            }
            if (stddevSeatTime == null) {
                log.warn("Missing stddevSeatTime for matchId={}", singleData.getStddevSeatSelectTime());
                missing = true;
            }

            // 모든 값 존재하면 break
            if (!missing) {
                break;
            }

        }

        // Match내 개별 사용자에 대한 Ranking 상정
        // BASE SCORE + SPEED BONUS로 MMR산정(MatchMakingRating)
        for(RankingDTO singleUser : givenMatchData){
            log.info("single user info {}", singleUser.toString());
            int point = 0;
            int usedBots = singleUser.getUsedBotCount();

            int basePlayerCount = 0;
            int baseTotCount = 0;

            // 사용자 끼리 경기 시 등수
            if(usedBots ==0){
                basePlayerCount = singleUser.getUserRank();
                baseTotCount = singleUser.getUserCount();

            }
            // 봇 포함 경기 시 등수
            else{
                basePlayerCount= singleUser.getTotalRank();
                baseTotCount = singleUser.getUsedBotCount();

            }
            // Base 점수
            // (BASE_SCORE * SKILLFACTOR) * PEOPLEFACTOR * DIFFICULTYFACTOR + SPEED BONUS
            // PEOPLEFACTOR는 최대 1.3배까지만 반영
            // DIFFICULTYFACTOR는 최대 1.3배까지만 반영
            // SPEED BONUS는 경기를 마친 사람에게만 부여.
            // 최대 300점까지 부여.
            int finalScore = 0;
            float baseScore = 0f;
            float skillFactor = RoundBy.decimal((float) (1 - basePlayerCount / baseTotCount), 2);

            float normLog = (float) ( Math.log10(baseTotCount) / Math.log10(BASE_LOG)) ;
            normLog = Math.max(0f, Math.min(1f, normLog));

            float peopleFactor = 1f + PEOPLE_FACTOR_MAX * normLog * skillFactor;

            Match.Difficulty difficulty =  singleUser.getDifficulty();
            float difficultyFactor = 1f;
            switch(difficulty){
                case EASY -> difficultyFactor = 1.0f;
                case MEDIUM -> difficultyFactor = 1.15f;
                case HARD -> difficultyFactor = 1.3f;
            }

            baseScore = BOT_BASE_SCORE * skillFactor * peopleFactor * difficultyFactor;

            // Speed Bonus
            // 경기 끝난 사람에게만 점수 부여,
            // 표준점수로 보너스 계산
            float speedBonus = -1f;
            boolean finishedFlag = singleUser.getIsSuccess();
            if(!finishedFlag){
                speedBonus = 0f;
            }else{
                float userQueueClickTime = singleUser.getUserDateSelectTime();
                float userSeccodeClickTime = singleUser.getUserSeccodeSelectTime();
                float userSeatClickTime = singleUser.getUserSeatSelectTime();

                float zQueue   = safeZCalculate(avgQueueTime,   stddevQueueTime,   userQueueClickTime);
                float zCaptcha = safeZCalculate(avgCaptchaTime, stddevCaptchaTime, userSeccodeClickTime);
                float zSeat    = safeZCalculate(avgSeatTime,    stddevSeatTime,    userSeatClickTime) ;

                // 2. 구간별 중요도 가중치
                final float W_QUEUE   = 0.4f;
                final float W_CAPTCHA = 0.2f;
                final float W_SEAT    = 0.4f;

                // 3. 속도 지수(speedIndex)
                float speedIndex =
                        W_QUEUE   * zQueue +
                        W_CAPTCHA * zCaptcha +
                        W_SEAT    * zSeat;

                // 4. speed bonus 계산 (z-score × 비율)
                final float SPEED_UNIT      = 100f;   // z 1당 100점

                final float MAX_SPEED_BONUS = 300f;  // 상한 300
                final float MIN_SPEED_BONUS = 0;     // 하한 -0

                float rawBonus = SPEED_UNIT * speedIndex;

                rawBonus = Math.max(MIN_SPEED_BONUS, Math.min(MAX_SPEED_BONUS, rawBonus));

            }



        }

        return givenMatchData;
    }



    // std가 0일 수도 있으니 방어 코드
    private static float safeZCalculate(float avg, float std, Float my) {
        if (std <= 0.0001f) return 0f;
        if(my==null){
            return 0f;
        }
        return (avg - my) / std;  // 빠를수록 z가 커짐
    }



}
