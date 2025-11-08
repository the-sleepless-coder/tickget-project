package com.ticketing.seat.service;

import com.ticketing.entity.Match;
import com.ticketing.entity.Match.MatchStatus;
import com.ticketing.seat.redis.MatchStatusRepository;
import com.ticketing.seat.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

/**
 * DB(matches.status)를 기준으로 Redis match:{matchId}:status 값을 교정하는 자기치유 서비스.
 * 정책:
 *  - DB = PLAYING  => Redis = "OPEN"
 *  - DB = FINISHED => Redis = "CLOSED"
 *  - DB = WAITING  => Redis = "CLOSED" (시작 전이므로 예약 불가)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchStatusSyncService {

    private final MatchRepository matchRepository;
    private final MatchStatusRepository matchStatusRepository;
    private final StringRedisTemplate redisTemplate;

    @Transactional(readOnly = true)
    public void syncAllMatchStatuses() {
        // PLAYING -> "OPEN"
        List<Match> playing = matchRepository.findByStatus(MatchStatus.PLAYING);
        for (Match m : playing) {
            String rs = matchStatusRepository.getMatchStatus(m.getMatchId());
            if (!"OPEN".equalsIgnoreCase(rs)) {
                matchStatusRepository.setMatchStatus(m.getMatchId(), "OPEN");
            }
        }

        // FINISHED -> "CLOSED"
        List<Match> finished = matchRepository.findByStatus(MatchStatus.FINISHED);
        for (Match m : finished) {
            String rs = matchStatusRepository.getMatchStatus(m.getMatchId());
            if (!"CLOSED".equalsIgnoreCase(rs)) {
                matchStatusRepository.setMatchStatus(m.getMatchId(), "CLOSED");
            }
        }

        // WAITING -> "CLOSED" (아직 시작 전)
        List<Match> waiting = matchRepository.findByStatus(MatchStatus.WAITING);
        for (Match m : waiting) {
            String rs = matchStatusRepository.getMatchStatus(m.getMatchId());
            if (!"CLOSED".equalsIgnoreCase(rs)) {
                matchStatusRepository.setMatchStatus(m.getMatchId(), "CLOSED");
            }
        }
    }

    /**
     * 경기 종료 시 해당 경기의 Redis 데이터 정리
     * 좌석 선점/확정 키, 상태 키, 카운트 키를 모두 삭제하여 메모리 최적화
     *
     * @param matchId 정리할 경기 ID
     * @return 삭제된 키 개수
     */
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

            log.info("경기 종료 후 Redis 정리 완료: matchId={}, deletedKeys={}", matchId, deletedCount);

        } catch (Exception e) {
            log.error("경기 Redis 정리 중 오류 발생: matchId={}", matchId, e);
        }

        return deletedCount;
    }
}