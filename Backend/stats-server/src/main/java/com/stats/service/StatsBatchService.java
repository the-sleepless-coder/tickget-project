package com.stats.service;

import com.stats.dto.MatchStatsAggregationDTO;
import com.stats.entity.MatchStats;
import com.stats.entity.UserStats;
import com.stats.repository.MatchStatsRepository;
import com.stats.repository.UserStatsRepository;
import com.stats.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import com.stats.util.StatsCalculator;

@Slf4j
@Service
@RequiredArgsConstructor
public class StatsBatchService {

    private final UserStatsRepository userStatsRepository;
    private final MatchStatsRepository matchStatsRepository;

    // 1. 단일 매치 통계 업데이트
    /**
     * 특정 매치의 통계를 계산하여 MatchStats 테이블에 저장/업데이트
     * @param matchId 매치 ID
     * @return 성공 여부
     */
    @Transactional
    public boolean updateMatchStats(Long matchId) {
        try {
            // 1. 해당 매치의 모든 UserStats 가져오기
            List<UserStats> userStatsList = userStatsRepository.findByMatchId(matchId);
            Integer playerCount = userStatsList.size();

            if (userStatsList.isEmpty()) {
                log.warn("No user stats found for matchId: {}", matchId);
                return false;
            }

            // 2. userStatsList에서, 해당 matchId에 대한 userStats 통계 집계
            MatchStatsAggregationDTO aggregation = aggregateStats(userStatsList, matchId);

            // 3. MatchStats 엔티티 생성하기.
            MatchStats matchStats = matchStatsRepository.findByMatchId(matchId)
                    .orElse(new MatchStats());

            // 4.matchStats를 DTO에 넣어주기.
            matchStats.updateStats(aggregation);

            // 5. DB에 저장
            matchStatsRepository.save(matchStats);

            log.info("Successfully updated match stats for matchId: {} with {} players", matchId, playerCount);

            return true;

        } catch (Exception e) {
            log.error("Failed to update match stats for matchId: {}", matchId, e);
            return false;
        }
    }

    // ========================================
    // 2. 통계 집계 로직
    // ========================================

    /**
     * UserStats 리스트를 받아서 평균값 계산
     */
    private MatchStatsAggregationDTO aggregateStats(List<UserStats> userStatsList, Long matchId) {
        // BOT 제외한 플레이어만 집계
        List<UserStats> playerStats = userStatsList.stream()
                .filter(us -> !StatsCalculator.isBot(us))  // BOT 판별 로직
                .collect(Collectors.toList());

        int playerCount = playerStats.size();

        if (playerCount == 0) {
            log.warn("No player stats to aggregate (all bots)");
            return createEmptyAggregation();
        }

        //======= 1. 평균 계산 =======
        // 날짜 선택 평균 계산
        Float avgDateSelectTime = RoundBy.decimal(StatsCalculator.calculateAvgFloat(playerStats, UserStatsFloatExtractors.DATE_SELECT_TIME),2);

        Float avgDateMissCount = RoundBy.decimal(StatsCalculator.calculateAvgInt(playerStats, UserStatsIntegerExtractors.DATE_MISS_COUNT),2);

        // 보안문자 평균 계산
        Float avgSeccodeSelectTime = RoundBy.decimal(StatsCalculator.calculateAvgFloat(playerStats, UserStatsFloatExtractors.SECCODE_SELECT_TIME),2);

        Float avgSeccodeBackspaceCount =  RoundBy.decimal(StatsCalculator.calculateAvgInt(playerStats, UserStatsIntegerExtractors.SECCODE_BACKSPACE_COUNT),2);

        Float avgSeccodeTryCount = RoundBy.decimal(StatsCalculator.calculateAvgInt(playerStats, UserStatsIntegerExtractors.SECCODE_TRIAL_COUNT),2);

        // 좌석 선택 평균
        Float avgSeatSelectTime = RoundBy.decimal(StatsCalculator.calculateAvgFloat(playerStats, UserStatsFloatExtractors.SEAT_SELECT_TIME),2);
        Float avgSeatSelectTryCount = RoundBy.decimal(StatsCalculator.calculateAvgInt(playerStats, UserStatsIntegerExtractors.SEAT_SELECT_TRY_COUNT),2);
        Float avgSeatSelectClickMissCount = RoundBy.decimal(StatsCalculator.calculateAvgInt(playerStats, UserStatsIntegerExtractors.SEAT_SELECT_CLICK_MISS_COUNT),2);

        //======= 2. 표준 편차 계산 =======
        Float stddevDateSelectTime = RoundBy.decimal( StatsCalculator.calculateStdDevFloat(playerStats, UserStatsFloatExtractors.DATE_SELECT_TIME, avgDateSelectTime), 2);
        Float stddevSeccodeSelectTime = RoundBy.decimal( StatsCalculator.calculateStdDevFloat(playerStats, UserStatsFloatExtractors.SECCODE_SELECT_TIME, avgSeccodeSelectTime), 2);
        Float stddevSeatSelectTime = RoundBy.decimal( StatsCalculator.calculateStdDevFloat(playerStats, UserStatsFloatExtractors.SEAT_SELECT_TIME, avgSeatSelectTime), 2);

        return MatchStatsAggregationDTO
                .dtobuilder(matchId,
                        MatchStats.Type.ALL ,
                        avgDateSelectTime,
                        avgDateMissCount,
                        avgSeccodeSelectTime,
                        avgSeccodeBackspaceCount,
                        avgSeccodeTryCount,
                        avgSeatSelectTime,
                        avgSeatSelectTryCount,
                        avgSeatSelectClickMissCount,
                        playerCount,
                        stddevDateSelectTime,
                        stddevSeccodeSelectTime,
                        stddevSeatSelectTime
                        );

    }


    /**
     * 빈 집계 결과 생성 (BOT만 있을 때)
     */
    private MatchStatsAggregationDTO createEmptyAggregation() {
        return MatchStatsAggregationDTO.builder()
                .playerCount(0)
                .avgDateSelectTime(0f)
                .avgDateMissCount(0f)
                .avgSeccodeSelectTime(0f)
                .avgSeccodeBackspaceCount(0f)
                .avgSeccodeTryCount(0f)
                .avgSeatSelectTime(0f)
                .avgSeatSelectTryCount(0f)
                .avgSeatSelectClickMissCount(0f)
                .build();
    }

    // ========================================
    // 3. 배치 작업 (스케줄링)
    // ========================================

    /**
     * 매일 새벽 2시에 전체 매치 통계 업데이트
     * (아직 통계가 생성되지 않은 매치만 처리)
     */
    @Scheduled(cron = "0 0 2 * * *")
    public void scheduledBatchUpdateNewMatches() {
        log.info("===== Starting scheduled batch update for new matches =====");

        List<Long> matchIdsWithoutStats = userStatsRepository.findMatchIdsWithoutStats();

        log.info("Found {} matches without stats", matchIdsWithoutStats.size());

        int successCount = 0;
        int failCount = 0;

        for (Long matchId : matchIdsWithoutStats) {
            boolean success = updateMatchStats(matchId);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
        }

        log.info("===== Batch update completed: {} success, {} failed =====",
                successCount, failCount);
    }

    /**
     * 수동 실행: 전체 매치 통계 재계산
     * (관리자 API에서 호출)
     */
    public void manualBatchUpdateAllMatches() {
        log.info("===== Starting manual batch update for ALL matches =====");

        List<Long> allMatchIds = userStatsRepository.findDistinctMatchIds();

        log.info("Found {} total matches", allMatchIds.size());

        int successCount = 0;
        int failCount = 0;

        for (Long matchId : allMatchIds) {
            boolean success = updateMatchStats(matchId);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
        }

        log.info("===== Manual batch update completed: {} success, {} failed =====",
                successCount, failCount);
    }

    /**
     * 특정 조건의 매치만 재계산
     */
    /**
    public void updateMatchStatsForDateRange(LocalDateTime startDate, LocalDateTime endDate) {
        log.info("===== Updating match stats for date range: {} to {} =====",
                startDate, endDate);

        List<Long> matchIds = userStatsRepository.findMatchIdsByDateRange(startDate, endDate);

        log.info("Found {} matches in date range", matchIds.size());

        int successCount = 0;

        for (Long matchId : matchIds) {
            if (updateMatchStats(matchId)) {
                successCount++;
            }
        }

        log.info("===== Date range update completed: {} success =====", successCount);
    }
     */
}
