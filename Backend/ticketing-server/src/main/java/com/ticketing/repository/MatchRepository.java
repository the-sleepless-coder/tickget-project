package com.ticketing.repository;

import com.ticketing.entity.Match;
import com.ticketing.entity.Match.MatchStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface MatchRepository extends JpaRepository<Match, Long> {

    // 동기화 대상 찾을 때 쓸 수 있는 헬퍼들
    List<Match> findByStatus(MatchStatus status);

    // roomId기준으로 match 정보 조회
    List<Match> findByRoomIdAndStatus(Long roomId, MatchStatus status);

    // matchStatus, 현재 시간 기준으로 찾는다.
    List<Match> findByStatusAndStartedAtBefore(MatchStatus matchStatus, LocalDateTime now);
}
