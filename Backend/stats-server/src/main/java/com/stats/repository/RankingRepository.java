package com.stats.repository;

import com.stats.dto.response.MatchData.MatchInfoStatsDTO;
import com.stats.dto.response.RankingData.RankingDTO;
import com.stats.entity.MatchStats;
import com.stats.entity.Ranking;
import io.lettuce.core.dynamic.annotation.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RankingRepository extends JpaRepository<Ranking, Long> {
    // userId 를 이용한 Ranking 확인
    Optional<MatchStats> findByUserId(Long userId);

    @Query("""
    select new com.stats.dto.response.RankingData.RankingDTO(
        u.id,
        u.nickname,
        us.userRank,
        us.totalRank,
        m.userCount,
        m.usedBotCount,
        m.difficulty,
        ms.avgDateSelectTime,
        ms.avgSeccodeSelectTime,
        ms.avgSeatSelectTime,
        ms.stddevDateSelectTime,
        ms.stddevSeatSelectTime,
        ms.stddevSeccodeSelectTime,
        us.dateSelectTime,
        us.seccodeSelectTime,
        us.seatSelectTime,
        us.isSuccess
    )
    from Match m
    left join UserStats us on us.matchId = m.matchId
    left join User u on u.id = us.userId
    left join MatchStats ms on ms.matchId = m.matchId
    where m.matchId = :matchId
    order by us.userRank asc
""")
    List<RankingDTO> findRankingByMatchId(@Param("matchId") Long matchId);

    // 하루 내 몇번째 Snapshot인지 확인한다.
    // 해당 날짜에 동일한 시즌일 경우, 몇번째인지 확인한다.
    @Query(value = """
        SELECT COALESCE(MAX(r.snapshot_no), 0)
        FROM ranking r
        WHERE r.season_id = :seasonId
          AND DATE(r.snapshot_at) = :date
    """, nativeQuery = true)
    Optional<Integer> findMaxSnapshotSeq(
            @Param("seasonId") Long seasonId,
            @Param("date") LocalDate date
    );

    // 해당 Season 내, 주어진 userId의 기록 최대 N개
    Page<Ranking> findByUserIdAndSeasonIdOrderBySnapshotAtDesc(
            Long userId,
            Long seasonId,
            Pageable pageable
    );

    // 해당 Season 내, 주어진 userId의 모든 데이터 가져오기.
    List<Ranking> findByUserIdAndSeasonIdOrderBySnapshotAtDesc(
            Long userId,
            Long seasonId
    );
}
