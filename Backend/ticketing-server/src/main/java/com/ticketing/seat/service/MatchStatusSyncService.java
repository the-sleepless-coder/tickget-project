package com.ticketing.seat.service;

import com.ticketing.entity.Match;
import com.ticketing.entity.Match.MatchStatus;
import com.ticketing.seat.redis.MatchStatusRepository;
import com.ticketing.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * DB(matches.status)를 기준으로 Redis match:{matchId}:status 값을 교정하는 자기치유 서비스.
 * 정책:
 *  - DB = PLAYING  => Redis = "OPEN"
 *  - DB = FINISHED => Redis = "CLOSED"
 *  - DB = WAITING  => Redis = "CLOSED" (시작 전이므로 예약 불가)
 */
@Service
@RequiredArgsConstructor
public class MatchStatusSyncService {

    private final MatchRepository matchRepository;
    private final MatchStatusRepository matchStatusRepository;

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
}
