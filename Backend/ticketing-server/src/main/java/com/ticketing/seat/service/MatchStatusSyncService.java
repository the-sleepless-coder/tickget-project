package com.ticketing.seat.service;

import com.ticketing.entity.Match;
import com.ticketing.entity.Match.MatchStatus;
import com.ticketing.seat.redis.MatchStatusRepository;
import com.ticketing.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * DB와 Redis 상태 동기화 및 자가치유 서비스
 *
 * 주요 기능:
 * 1. DB 기준 Redis 상태 교정 (PLAYING → OPEN, FINISHED → CLOSED)
 * 2. Redis 키가 없는 PLAYING 경기 자동 종료
 * 3. 경기 종료 시 Redis 정리
 * 4. 스케줄러로 주기적 실행
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchStatusSyncService {

    private final MatchRepository matchRepository;
    private final MatchStatusRepository matchStatusRepository;
    private final StringRedisTemplate redisTemplate;
    private final RoomServerClient roomServerClient;

    /**
     * 매 5분마다 자동 실행되는 스케줄러
     * 1. DB 기준 Redis 상태 교정
     * 2. Redis 키 없는 PLAYING 경기 종료
     */
    @Scheduled(fixedDelay = 300000) // 5분
    public void scheduledSync() {
        log.info("=== 경기 상태 동기화 스케줄러 시작 ===");

        try {
            // 1. DB 기준 Redis 상태 교정
            syncAllMatchStatuses();

            // 2. Redis 키 없는 PLAYING 경기 종료
            finishOrphanedMatches();

            log.info("=== 경기 상태 동기화 스케줄러 완료 ===");

        } catch (Exception e) {
            log.error("경기 상태 동기화 스케줄러 실행 중 오류", e);
        }
    }

    /**
     * DB 기준 Redis 상태 교정
     * - PLAYING → "OPEN"
     * - FINISHED → "CLOSED"
     * - WAITING → "CLOSED"
     */
    @Transactional(readOnly = true)
    public void syncAllMatchStatuses() {
        log.info("DB 기준 Redis 상태 교정 시작");

        int syncedCount = 0;

        // PLAYING -> "OPEN"
        List<Match> playing = matchRepository.findByStatus(MatchStatus.PLAYING);
        for (Match m : playing) {
            String rs = matchStatusRepository.getMatchStatus(m.getMatchId());
            if (!"OPEN".equalsIgnoreCase(rs)) {
                matchStatusRepository.setMatchStatus(m.getMatchId(), "OPEN");
                log.info("Redis 상태 교정: matchId={}, DB=PLAYING → Redis=OPEN", m.getMatchId());
                syncedCount++;
            }
        }

        // FINISHED -> "CLOSED"
        List<Match> finished = matchRepository.findByStatus(MatchStatus.FINISHED);
        for (Match m : finished) {
            String rs = matchStatusRepository.getMatchStatus(m.getMatchId());
            if (!"CLOSED".equalsIgnoreCase(rs)) {
                matchStatusRepository.setMatchStatus(m.getMatchId(), "CLOSED");
                log.info("Redis 상태 교정: matchId={}, DB=FINISHED → Redis=CLOSED", m.getMatchId());
                syncedCount++;
            }
        }

        // WAITING -> "CLOSED"
        List<Match> waiting = matchRepository.findByStatus(MatchStatus.WAITING);
        for (Match m : waiting) {
            String rs = matchStatusRepository.getMatchStatus(m.getMatchId());
            if (!"CLOSED".equalsIgnoreCase(rs)) {
                matchStatusRepository.setMatchStatus(m.getMatchId(), "CLOSED");
                log.info("Redis 상태 교정: matchId={}, DB=WAITING → Redis=CLOSED", m.getMatchId());
                syncedCount++;
            }
        }

        log.info("DB 기준 Redis 상태 교정 완료: 교정 건수={}", syncedCount);
    }

    /**
     * Redis 키가 모두 삭제된 PLAYING 경기를 FINISHED로 자동 종료
     *
     * 검사 항목:
     * - match:{matchId}:status
     * - humanusers:match:{matchId}
     * - seat:{matchId}:* (좌석 키들)
     *
     * 위 키들이 모두 없으면 경기가 비정상 종료된 것으로 판단
     */
    @Transactional
    public int finishOrphanedMatches() {
        log.info("Redis 키 없는 PLAYING 경기 정리 시작");

        List<Match> playingMatches = matchRepository.findByStatus(MatchStatus.PLAYING);
        int finishedCount = 0;

        for (Match match : playingMatches) {
            Long matchId = match.getMatchId();

            try {
                // Redis 키 존재 여부 확인
                String statusKey = "match:" + matchId + ":status";
                String humanUsersKey = "humanusers:match:" + matchId;
                String seatPattern = "seat:" + matchId + ":*";

                Boolean statusExists = redisTemplate.hasKey(statusKey);
                Boolean humanUsersExists = redisTemplate.hasKey(humanUsersKey);
                Set<String> seatKeys = redisTemplate.keys(seatPattern);

                // Redis 키가 하나도 없으면 경기 종료 처리
                boolean noRedisKeys = Boolean.FALSE.equals(statusExists)
                        && Boolean.FALSE.equals(humanUsersExists)
                        && (seatKeys == null || seatKeys.isEmpty());

                if (noRedisKeys) {
                    log.warn("⚠️  Redis 키 없는 PLAYING 경기 발견 - 자동 종료 처리: matchId={}", matchId);

                    // 통계 데이터가 있으면 설정 (없으면 0으로)
                    if (match.getSuccessUserCount() == null) {
                        match.setSuccessUserCount(0);
                    }
                    if (match.getSuccessBotCount() == null) {
                        match.setSuccessBotCount(0);
                    }

                    // 경기 종료 처리
                    match.setStatus(MatchStatus.FINISHED);
                    match.setEndedAt(LocalDateTime.now());
                    match.setUpdatedAt(LocalDateTime.now());
                    matchRepository.save(match);

                    // 룸 서버 알림
                    Long roomId = match.getRoomId();
                    boolean notificationSuccess = roomServerClient.notifyMatchEnd(roomId);

                    if (notificationSuccess) {
                        log.info("✅ 자동 경기 종료 완료: matchId={}, roomId={}", matchId, roomId);
                    } else {
                        log.warn("⚠️  자동 경기 종료됨 (룸 서버 알림 실패): matchId={}, roomId={}", matchId, roomId);
                    }

                    finishedCount++;
                }

            } catch (Exception e) {
                log.error("경기 자동 종료 처리 중 오류: matchId={}", matchId, e);
            }
        }

        if (finishedCount > 0) {
            log.info("Redis 키 없는 PLAYING 경기 정리 완료: 종료 건수={}", finishedCount);
        } else {
            log.info("Redis 키 없는 PLAYING 경기 없음");
        }

        return finishedCount;
    }

    /**
     * 경기 종료 시 Redis 데이터 정리
     * 좌석 선점/확정 키, 상태 키, 카운트 키를 모두 삭제하여 메모리 최적화
     *
     * ⚠️  주의: SeatConfirmationService.cleanupAllMatchRedis()와 중복
     * 향후 리팩토링 필요
     *
     * @param matchId 정리할 경기 ID
     * @return 삭제된 키 개수
     */
    @Deprecated
    public int cleanupMatchRedis(Long matchId) {
        log.info("경기 종료 후 Redis 정리 시작: matchId={}", matchId);

        int deletedCount = 0;

        try {
            // 1. 좌석 선점/확정 키 삭제: seat:{matchId}:*
            String seatPattern = "seat:" + matchId + ":*";
            Set<String> seatKeys = redisTemplate.keys(seatPattern);
            if (seatKeys != null && !seatKeys.isEmpty()) {
                Long deleted = redisTemplate.delete(seatKeys);
                deletedCount += (deleted != null ? deleted.intValue() : 0);
                log.info("좌석 키 삭제: matchId={}, count={}", matchId, deleted);
            }

            // 2. 경기 상태 키 삭제: match:{matchId}:status
            String statusKey = "match:" + matchId + ":status";
            if (Boolean.TRUE.equals(redisTemplate.delete(statusKey))) {
                deletedCount++;
                log.info("경기 상태 키 삭제: matchId={}", matchId);
            }

            // 3. 예약 카운트 키 삭제: match:{matchId}:reserved_count
            String countKey = "match:" + matchId + ":reserved_count";
            if (Boolean.TRUE.equals(redisTemplate.delete(countKey))) {
                deletedCount++;
                log.info("예약 카운트 키 삭제: matchId={}", matchId);
            }

            // 4. 확정 카운트 키 삭제
            String confirmedCountKey = "match:" + matchId + ":confirmed_count";
            String confirmedHumanCountKey = "match:" + matchId + ":confirmed_human_count";
            redisTemplate.delete(confirmedCountKey);
            redisTemplate.delete(confirmedHumanCountKey);

            // 5. 실제 유저 카운터 키 삭제
            String humanUsersKey = "humanusers:match:" + matchId;
            redisTemplate.delete(humanUsersKey);

            // 6. 등수 카운터 키 삭제
            String humanRankCounterKey = "match:" + matchId + ":human_rank_counter";
            String totalRankCounterKey = "match:" + matchId + ":total_rank_counter";
            redisTemplate.delete(humanRankCounterKey);
            redisTemplate.delete(totalRankCounterKey);

            // 7. 개별 유저 등수 키 삭제
            String userRankPattern = "user:*:match:" + matchId + ":rank";
            String userTotalRankPattern = "user:*:match:" + matchId + ":totalRank";
            Set<String> userRankKeys = redisTemplate.keys(userRankPattern);
            Set<String> userTotalRankKeys = redisTemplate.keys(userTotalRankPattern);
            if (userRankKeys != null && !userRankKeys.isEmpty()) {
                redisTemplate.delete(userRankKeys);
            }
            if (userTotalRankKeys != null && !userTotalRankKeys.isEmpty()) {
                redisTemplate.delete(userTotalRankKeys);
            }

            log.info("경기 종료 후 Redis 정리 완료: matchId={}, deletedKeys={}", matchId, deletedCount);

        } catch (Exception e) {
            log.error("경기 Redis 정리 중 오류 발생: matchId={}", matchId, e);
        }

        return deletedCount;
    }

    /**
     * 수동 실행용: 특정 경기의 Redis 키 존재 여부 확인
     */
    public boolean hasMatchRedisKeys(Long matchId) {
        String statusKey = "match:" + matchId + ":status";
        String humanUsersKey = "humanusers:match:" + matchId;
        String seatPattern = "seat:" + matchId + ":*";

        Boolean statusExists = redisTemplate.hasKey(statusKey);
        Boolean humanUsersExists = redisTemplate.hasKey(humanUsersKey);
        Set<String> seatKeys = redisTemplate.keys(seatPattern);

        return Boolean.TRUE.equals(statusExists)
                || Boolean.TRUE.equals(humanUsersExists)
                || (seatKeys != null && !seatKeys.isEmpty());
    }
}