package com.ticketing.repository;

import com.ticketing.entity.Match;
import com.ticketing.entity.Match.MatchStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface MatchRepository extends JpaRepository<Match, Long> {

    // 동기화 대상 찾을 때 쓸 수 있는 헬퍼들
    List<Match> findByStatus(MatchStatus status);

    // roomId기준으로 match 정보 조회
    List<Match> findByRoomIdAndStatus(Long roomId, MatchStatus status);

    // matchStatus, 현재 시간 기준으로 찾는다.
    List<Match> findByStatusAndStartedAtBefore(MatchStatus matchStatus, LocalDateTime now);

    // roomId로 가장 최근 매치 조회 (경기 중 유저 퇴장 처리용)
    Optional<Match> findTopByRoomIdOrderByCreatedAtDesc(Long roomId);

}