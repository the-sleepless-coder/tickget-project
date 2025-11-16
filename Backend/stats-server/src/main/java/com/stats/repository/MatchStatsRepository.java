package com.stats.repository;

import com.stats.entity.MatchStats;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MatchStatsRepository extends JpaRepository<MatchStats, Long> {
    // matchId를 이용한 매치 검색.
    MatchStats findByMatchId(Long matchId);


}
