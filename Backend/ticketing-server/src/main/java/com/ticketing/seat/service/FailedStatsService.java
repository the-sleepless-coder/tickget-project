package com.ticketing.seat.service;

import com.ticketing.entity.Match;
import com.ticketing.entity.UserStats;
import com.ticketing.repository.MatchRepository;
import com.ticketing.repository.UserStatsRepository;
import com.ticketing.seat.dto.FailedStatsRequest;
import com.ticketing.seat.dto.FailedStatsResponse;
import com.ticketing.seat.exception.MatchNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 예매 실패 사용자 통계 저장 서비스
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FailedStatsService {

    private final MatchRepository matchRepository;
    private final UserStatsRepository userStatsRepository;

    /**
     * 예매 실패 사용자 통계 저장
     *
     * @param matchId 매치 ID
     * @param request 실패 통계 요청 (userId, 통계 데이터)
     * @return 저장 성공 여부
     */
    @Transactional
    public FailedStatsResponse saveFailedStats(Long matchId, FailedStatsRequest request) {
        log.info("예매 실패 통계 저장 시작: matchId={}, userId={}", matchId, request.getUserId());

        try {
            // 1. userId 필수 검증
            if (request.getUserId() == null) {
                log.warn("userId가 없습니다: matchId={}", matchId);
                return FailedStatsResponse.builder()
                        .success(false)
                        .build();
            }

            Long userId = request.getUserId();

            // 2. Match 존재 확인
            Match match = matchRepository.findById(matchId)
                    .orElseThrow(() -> new MatchNotFoundException(matchId));

            // 3. 중복 저장 방지 (이미 통계가 있는지 확인)
            boolean alreadyExists = userStatsRepository
                    .existsByUserIdAndMatchId(userId, matchId);

            if (alreadyExists) {
                log.warn("이미 저장된 통계 데이터가 있습니다: matchId={}, userId={}", matchId, userId);
                return FailedStatsResponse.builder()
                        .success(false)
                        .build();
            }

            // 4. UserStats 저장 (실패 데이터)
            UserStats userStats = UserStats.builder()
                    .userId(userId)
                    .matchId(matchId)
                    .isSuccess(false)  // 실패
                    .dateSelectTime(request.getDateSelectTime() != null ? request.getDateSelectTime() : 0f)
                    .dateMissCount(request.getDateMissCount() != null ? request.getDateMissCount() : 0)
                    .seccodeSelectTime(request.getSeccodeSelectTime() != null ? request.getSeccodeSelectTime() : 0f)
                    .seccodeBackspaceCount(request.getSeccodeBackspaceCount() != null ? request.getSeccodeBackspaceCount() : 0)
                    .seccodeTryCount(request.getSeccodeTryCount() != null ? request.getSeccodeTryCount() : 0)
                    .seatSelectTime(request.getSeatSelectTime() != null ? request.getSeatSelectTime() : 0f)
                    .seatSelectTryCount(request.getSeatSelectTryCount() != null ? request.getSeatSelectTryCount() : 0)
                    .seatSelectClickMissCount(request.getSeatSelectClickMissCount() != null ? request.getSeatSelectClickMissCount() : 0)
                    .userRank(-1)   // 실패 시 -1
                    .totalRank(-1)  // 실패 시 -1
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();

            userStatsRepository.save(userStats);

            log.info("예매 실패 통계 저장 완료: matchId={}, userId={}", matchId, userId);

            return FailedStatsResponse.builder()
                    .success(true)
                    .build();

        } catch (MatchNotFoundException e) {
            log.warn("매치 없음: matchId={}", matchId);
            throw e;

        } catch (Exception e) {
            log.error("예매 실패 통계 저장 중 오류 발생: matchId={}, userId={}",
                    matchId, request.getUserId(), e);
            return FailedStatsResponse.builder()
                    .success(false)
                    .build();
        }
    }
}