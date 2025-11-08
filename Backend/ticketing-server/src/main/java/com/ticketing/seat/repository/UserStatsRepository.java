package com.ticketing.seat.repository;

import com.ticketing.seat.entity.UserStats;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserStatsRepository extends JpaRepository<UserStats, Long> {

    List<UserStats> findByMatchId(Long matchId);

    List<UserStats> findByUserId(Long userId);

    List<UserStats> findByMatchIdAndUserId(Long matchId, Long userId);
}