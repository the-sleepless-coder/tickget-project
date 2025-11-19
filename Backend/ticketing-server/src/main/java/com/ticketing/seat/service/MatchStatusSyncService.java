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

@Slf4j
@Service
@RequiredArgsConstructor
public class MatchStatusSyncService {

    private final MatchRepository matchRepository;
    private final MatchStatusRepository matchStatusRepository;
    private final StringRedisTemplate redisTemplate;
    private final RoomServerClient roomServerClient;
    private final StatsServerClient statsServerClient;

    // 경기 시작 후 자동 종료 시간 (분)
    private static final int AUTO_FINISH_MINUTES = 30;

    /**
     * 매 5분마다 자동 실행되는 스케줄러
     * 1. DB 기준 Redis 상태 교정
     * 2. Redis 키 없는 PLAYING 경기 종료
     * 3. 시작 후 30분 경과한 PLAYING 경기 자동 종료
     */
    @Scheduled(fixedDelay = 300000) // 5분
    public void scheduledSync() {
        log.info("=== 경기 상태 동기화 스케줄러 시작 ===");

        try {
            // 1. DB 기준 Redis 상태 교정
            syncAllMatchStatuses();

            // 2. Redis 키 없는 PLAYING 경기 종료
            finishOrphanedMatches();

            // 3. 시작 후 30분 경과한 PLAYING 경기 자동 종료
            finishTimeExpiredMatches();

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
                    log.warn("⚠️ Redis 키 없는 PLAYING 경기 발견 - 자동 종료 처리: matchId={}", matchId);

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

                    // Stats 서버 알림
                    boolean statsNotificationSuccess = statsServerClient.notifyMatchEnd(matchId);
                    if (statsNotificationSuccess) {
                        log.info("Stats 서버 매치 종료 알림 성공: matchId={}", matchId);
                    } else {
                        log.warn("Stats 서버 매치 종료 알림 실패: matchId={}", matchId);
                    }

                    // 룸 서버 알림
                    Long roomId = match.getRoomId();
                    boolean notificationSuccess = roomServerClient.notifyMatchEnd(roomId);

                    if (notificationSuccess) {
                        log.info("✅ 자동 경기 종료 완료: matchId={}, roomId={}", matchId, roomId);
                    } else {
                        log.warn("⚠️ 자동 경기 종료됨 (룸 서버 알림 실패): matchId={}, roomId={}", matchId, roomId);
                    }

                    log.info("ℹ️ 미확정 유저는 클라이언트에서 FailedStatsController API 호출 필요");

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
     * 시작 후 30분이 경과한 PLAYING 경기를 FINISHED로 자동 종료
     *
     * 목적:
     * - humanusers:match:{matchId}가 0이 안된 예외상황 처리
     * - ended_at이 null로 남는 문제 해결
     * - 시작시간(started_at) 기준으로 30분 경과 시 강제 종료
     *
     * 처리 과정:
     * 1. PLAYING 상태이면서 started_at + 30분을 초과한 경기 조회
     * 2. 통계 데이터가 없으면 0으로 설정
     * 3. DB 상태를 FINISHED로 변경, ended_at 설정
     * 4. Redis 키 전체 삭제 (좌석, 상태, 카운터 등)
     * 5. 룸 서버에 매치 종료 알림
     */
    @Transactional
    public int finishTimeExpiredMatches() {
        log.info("시작 후 {}분 경과한 PLAYING 경기 정리 시작", AUTO_FINISH_MINUTES);

        // 현재 시간으로부터 30분 전
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(AUTO_FINISH_MINUTES);

        // PLAYING 상태이면서 started_at이 threshold 이전인 경기들 조회
        List<Match> playingMatches = matchRepository.findByStatus(MatchStatus.PLAYING);
        int finishedCount = 0;

        for (Match match : playingMatches) {
            Long matchId = match.getMatchId();

            try {
                // started_at이 30분을 초과했는지 확인
                if (match.getStartedAt() != null && match.getStartedAt().isBefore(threshold)) {
                    log.warn("⚠️ 시작 후 {}분 경과한 PLAYING 경기 발견 - 자동 종료 처리: matchId={}, startedAt={}",
                            AUTO_FINISH_MINUTES, matchId, match.getStartedAt());

                    // 통계 데이터 Redis에서 가져오기 (없으면 0)
                    setMatchStatisticsFromRedis(matchId, match);

                    // 경기 종료 처리
                    match.setStatus(MatchStatus.FINISHED);
                    match.setEndedAt(LocalDateTime.now());
                    match.setUpdatedAt(LocalDateTime.now());
                    matchRepository.save(match);

                    // Redis 전체 정리
                  //  cleanupAllMatchRedis(matchId);

                    // Stats 서버 알림
                    boolean statsNotificationSuccess = statsServerClient.notifyMatchEnd(matchId);
                    if (statsNotificationSuccess) {
                        log.info("Stats 서버 매치 종료 알림 성공: matchId={}", matchId);
                    } else {
                        log.warn("Stats 서버 매치 종료 알림 실패: matchId={}", matchId);
                    }

                    // 룸 서버 알림
                    Long roomId = match.getRoomId();
                    boolean notificationSuccess = roomServerClient.notifyMatchEnd(roomId);

                    if (notificationSuccess) {
                        log.info("✅ 시간 경과 경기 자동 종료 완료: matchId={}, roomId={}, startedAt={}, endedAt={}",
                                matchId, roomId, match.getStartedAt(), match.getEndedAt());
                    } else {
                        log.warn("⚠️ 시간 경과 경기 종료됨 (룸 서버 알림 실패): matchId={}, roomId={}", matchId, roomId);
                    }

                    log.info("ℹ️ 미확정 유저는 클라이언트에서 FailedStatsController API 호출 필요");

                    finishedCount++;
                }

            } catch (Exception e) {
                log.error("시간 경과 경기 자동 종료 처리 중 오류: matchId={}", matchId, e);
            }
        }

        if (finishedCount > 0) {
            log.info("시간 경과 PLAYING 경기 정리 완료: 종료 건수={}", finishedCount);
        } else {
            log.debug("시간 경과 PLAYING 경기 없음");
        }

        return finishedCount;
    }

    /**
     * Redis에서 경기 통계 데이터 조회 및 Match 엔티티에 설정
     *
     * success_user_count와 success_bot_count는 Confirm 시점에 이미 증가되어 있음
     * 여기서는 최종 확인만 수행
     */
    private void setMatchStatisticsFromRedis(Long matchId, Match match) {
        try {
            // success_user_count, success_bot_count는 Confirm 시 이미 설정됨
            // 값이 없으면 0으로 설정
            if (match.getSuccessUserCount() == null) {
                match.setSuccessUserCount(0);
            }
            if (match.getSuccessBotCount() == null) {
                match.setSuccessBotCount(0);
            }

            log.info("경기 통계 설정: matchId={}, successUserCount={}, successBotCount={}",
                    matchId, match.getSuccessUserCount(), match.getSuccessBotCount());

        } catch (Exception e) {
            log.error("경기 통계 설정 중 오류 발생: matchId={}", matchId, e);
            // 오류 발생 시 0으로 설정
            match.setSuccessUserCount(0);
            match.setSuccessBotCount(0);
        }
    }

    /**
     * 경기 종료 시 Redis 전체 정리
     * - 좌석 키: seat:{matchId}:*
     * - 상태 키: match:{matchId}:status
     * - 카운트 키: match:{matchId}:reserved_count
     * - 실제 유저 키: humanusers:match:{matchId}
     * - 등수 카운터 키: match:{matchId}:human_rank_counter, total_rank_counter
     */
    private void cleanupAllMatchRedis(Long matchId) {
        log.info("경기 종료 - Redis 전체 정리 시작: matchId={}", matchId);

        try {
            // 1. 좌석 키 삭제
            String seatPattern = "seat:" + matchId + ":*";
            Set<String> seatKeys = redisTemplate.keys(seatPattern);
            if (seatKeys != null && !seatKeys.isEmpty()) {
                redisTemplate.delete(seatKeys);
                log.info("좌석 키 삭제: matchId={}, count={}", matchId, seatKeys.size());
            }

            // 2. 상태 키 삭제
            String statusKey = "match:" + matchId + ":status";
            redisTemplate.delete(statusKey);

            // 3. reserved_count 키 삭제
            String reservedCountKey = "match:" + matchId + ":reserved_count";
            redisTemplate.delete(reservedCountKey);

            // 4. 실제 유저 카운터 키 삭제
            String humanUsersKey = "humanusers:match:" + matchId;
            redisTemplate.delete(humanUsersKey);

            // 5. 등수 카운터 키 삭제
            String humanRankCounterKey = "match:" + matchId + ":human_rank_counter";
            String totalRankCounterKey = "match:" + matchId + ":total_rank_counter";
            redisTemplate.delete(humanRankCounterKey);
            redisTemplate.delete(totalRankCounterKey);

            log.info("경기 종료 - Redis 전체 정리 완료: matchId={}", matchId);

        } catch (Exception e) {
            log.error("경기 Redis 정리 중 오류 발생: matchId={}", matchId, e);
        }
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