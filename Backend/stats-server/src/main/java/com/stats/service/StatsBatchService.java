package com.stats.service;

import com.stats.dto.MatchStatsAggregationDTO;
import com.stats.entity.MatchStats;
import com.stats.entity.UserStats;
import com.stats.repository.MatchStatsRepository;
import com.stats.repository.UserStatsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.ToIntFunction;

//@Slf4j
//@Service
//@RequiredArgsConstructor
//public class StatsBatchService {
//
//    private final UserStatsRepository userStatsRepository;
//    private final MatchStatsRepository matchStatsRepository;
//
//    // 1. 단일 매치 통계 업데이트
//    /**
//     * 특정 매치의 통계를 계산하여 MatchStats 테이블에 저장/업데이트
//     * @param matchId 매치 ID
//     * @return 성공 여부
//     */
//    @Transactional
//    public boolean updateMatchStats(Long matchId) {
//        try {
//            // 1. 해당 매치의 모든 UserStats 가져오기
//            List<UserStats> userStatsList = userStatsRepository.findByMatchId(matchId);
//
//            if (userStatsList.isEmpty()) {
//                log.warn("No user stats found for matchId: {}", matchId);
//                return false;
//            }
//
//            // 2. 통계 집계
//            MatchStatsAggregationDTO aggregation = aggregateStats(userStatsList);
//
//            // 3. MatchStats 엔티티 가져오기 또는 생성
//            MatchStats matchStats = matchStatsRepository.findByMatchId(matchId);
//
//            // 4. 집계 matchStats에 넣어주기
//            matchStats.updateStats(aggregation);
//
//            // 5. 저장
//            matchStatsRepository.save(matchStats);
//
//            log.info("Successfully updated match stats for matchId: {} with {} players",
//                    matchId, aggregation.getPlayerCount());
//
//            return true;
//
//        } catch (Exception e) {
//            log.error("Failed to update match stats for matchId: {}", matchId, e);
//            return false;
//        }
//    }
//
//    // ========================================
//    // 2. 통계 집계 로직
//    // ========================================
//
//    /**
//     * UserStats 리스트를 받아서 평균값 계산
//     */
//    private MatchStatsAggregationDTO aggregateStats(List<UserStats> userStatsList) {
//
//        // BOT 제외한 플레이어만 집계
//        List<UserStats> playerStats = userStatsList.stream()
//                .filter(us -> !isBot(us))  // BOT 판별 로직
//                .collect(Collectors.toList());
//
//        int playerCount = playerStats.size();
//
//        if (playerCount == 0) {
//            log.warn("No player stats to aggregate (all bots)");
//            return createEmptyAggregation();
//        }
//
//        // 날짜 선택 평균
//        int avgDateSelectTime = calculateAvgInt(
//                playerStats, UserStats::getDateSelectTime
//        );
//        int avgDateMissCount = calculateAvgInt(
//                playerStats, UserStats::getDateMissCount
//        );
//
//        // 보안문자 평균
//        int avgSeccodeSelectTime = calculateAvgInt(
//                playerStats, UserStats::getSeccodeSelectTime
//        );
//        int avgSeccodeBackspaceCount = calculateAvgInt(
//                playerStats, UserStats::getSeccodeBackspaceCount
//        );
//        int avgSeccodeTryCount = calculateAvgInt(
//                playerStats, UserStats::getSeccodeTryCount
//        );
//
//        // 좌석 선택 평균
//        int avgSeatSelectTime = calculateAvgInt(
//                playerStats, UserStats::getSeatSelectTime
//        );
//        int avgSeatSelectTryCount = calculateAvgInt(
//                playerStats, UserStats::getSeatSelectTryCount
//        );
//        int avgSeatSelectClickMissCount = calculateAvgInt(
//                playerStats, UserStats::getSeatSelectClickMissCount
//        );
//
//        return MatchStatsAggregationDTO.builder()
//                .playerCount(playerCount)
//                .avgDateSelectTime(avgDateSelectTime)
//                .avgDateMissCount(avgDateMissCount)
//                .avgSeccodeSelectTime(avgSeccodeSelectTime)
//                .avgSeccodeBackspaceCount(avgSeccodeBackspaceCount)
//                .avgSeccodeTryCount(avgSeccodeTryCount)
//                .avgSeatSelectTime(avgSeatSelectTime)
//                .avgSeatSelectTryCount(avgSeatSelectTryCount)
//                .avgSeatSelectClickMissCount(avgSeatSelectClickMissCount)
//                .build();
//    }
//
//    // ========================================
//    // 3. 헬퍼 메서드들
//    // ========================================
//
//    /**
//     * Float 필드의 평균을 Integer로 반올림하여 계산
//     */
//    private int calculateAvgInt(
//            List<UserStats> stats,
//            Function<UserStats, Float> fieldExtractor
//    ) {
//        return (int) Math.round(
//                stats.stream()
//                        .mapToDouble(us -> fieldExtractor.apply(us))
//                        .average()
//                        .orElse(0.0)
//        );
//    }
//
//    /**
//     * Integer 필드의 평균을 계산
//     */
//    private int calculateAvgInt(
//            List<UserStats> stats,
//            ToIntFunction<UserStats> fieldExtractor
//    ) {
//        return (int) Math.round(
//                stats.stream()
//                        .mapToInt(fieldExtractor)
//                        .average()
//                        .orElse(0.0)
//        );
//    }
//
//    /**
//     * BOT 여부 판별
//     * (UserStats에 isBot 필드가 있다고 가정, 없으면 다른 방법으로 판별)
//     */
//    private boolean isBot(UserStats userStats) {
//        // 방법 1: UserStats에 isBot 필드가 있는 경우
//        // return userStats.getIsBot();
//
//        // 방법 2: userId가 특정 패턴인 경우 (예: 음수)
//        // return userStats.getUserId() < 0;
//
//        // 방법 3: User 테이블과 조인하여 확인 (성능 고려)
//        // 일단 false로 가정 (모두 플레이어)
//        return false;
//    }
//
//    /**
//     * 매치 타입 결정
//     */
//    private MatchStats.MatchType determineMatchType(List<UserStats> userStatsList) {
//        boolean hasPlayer = userStatsList.stream().anyMatch(us -> !isBot(us));
//        boolean hasBot = userStatsList.stream().anyMatch(this::isBot);
//
//        if (hasPlayer && hasBot) return MatchStats.MatchType.ALL;
//        if (hasBot) return MatchStats.MatchType.BOT;
//        return MatchStats.MatchType.PLAYER;
//    }
//
//    /**
//     * 빈 집계 결과 생성 (BOT만 있을 때)
//     */
//    private MatchStatsAggregationDTO createEmptyAggregation() {
//        return MatchStatsAggregationDTO.builder()
//                .playerCount(0)
//                .avgDateSelectTime(0)
//                .avgDateMissCount(0)
//                .avgSeccodeSelectTime(0)
//                .avgSeccodeBackspaceCount(0)
//                .avgSeccodeTryCount(0)
//                .avgSeatSelectTime(0)
//                .avgSeatSelectTryCount(0)
//                .avgSeatSelectClickMissCount(0)
//                .build();
//    }
//
//    // ========================================
//    // 4. 배치 작업 (스케줄링)
//    // ========================================
//
//    /**
//     * 매일 새벽 2시에 전체 매치 통계 업데이트
//     * (아직 통계가 생성되지 않은 매치만 처리)
//     */
//    @Scheduled(cron = "0 0 2 * * *")
//    public void scheduledBatchUpdateNewMatches() {
//        log.info("===== Starting scheduled batch update for new matches =====");
//
//        List<Long> matchIdsWithoutStats = userStatsRepository.findMatchIdsWithoutStats();
//
//        log.info("Found {} matches without stats", matchIdsWithoutStats.size());
//
//        int successCount = 0;
//        int failCount = 0;
//
//        for (Long matchId : matchIdsWithoutStats) {
//            boolean success = updateMatchStats(matchId);
//            if (success) {
//                successCount++;
//            } else {
//                failCount++;
//            }
//        }
//
//        log.info("===== Batch update completed: {} success, {} failed =====",
//                successCount, failCount);
//    }
//
//    /**
//     * 수동 실행: 전체 매치 통계 재계산
//     * (관리자 API에서 호출)
//     */
//    public void manualBatchUpdateAllMatches() {
//        log.info("===== Starting manual batch update for ALL matches =====");
//
//        List<Long> allMatchIds = userStatsRepository.findDistinctMatchIds();
//
//        log.info("Found {} total matches", allMatchIds.size());
//
//        int successCount = 0;
//        int failCount = 0;
//
//        for (Long matchId : allMatchIds) {
//            boolean success = updateMatchStats(matchId);
//            if (success) {
//                successCount++;
//            } else {
//                failCount++;
//            }
//        }
//
//        log.info("===== Manual batch update completed: {} success, {} failed =====",
//                successCount, failCount);
//    }
//
//    /**
//     * 특정 조건의 매치만 재계산
//     */
//    /**
//    public void updateMatchStatsForDateRange(LocalDateTime startDate, LocalDateTime endDate) {
//        log.info("===== Updating match stats for date range: {} to {} =====",
//                startDate, endDate);
//
//        List<Long> matchIds = userStatsRepository.findMatchIdsByDateRange(startDate, endDate);
//
//        log.info("Found {} matches in date range", matchIds.size());
//
//        int successCount = 0;
//
//        for (Long matchId : matchIds) {
//            if (updateMatchStats(matchId)) {
//                successCount++;
//            }
//        }
//
//        log.info("===== Date range update completed: {} success =====", successCount);
//    }
//     */
//}
