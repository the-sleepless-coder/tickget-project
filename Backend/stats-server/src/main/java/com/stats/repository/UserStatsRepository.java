package com.stats.repository;

import com.stats.dto.response.SpecificStatsDTO;
import com.stats.entity.UserStats;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserStatsRepository extends JpaRepository<UserStats, Long> {
    Optional<UserStats> findByUserId(Long userId);

    List<UserStats> findTop12ByUserIdOrderByCreatedAtDesc(Long userId);

    // 대결, 개인 모드 최근 5개 매치 가져오기.
    List<UserStats> findTop5ByUserIdOrderByCreatedAtDesc(Long userId);

    // 그냥 JPQL로 SQL문 때려박고 데이터 가져온다. -> specificsDTO활용
    // JPA스럽게 하려면 Lazy Fetch + Fetch Join을 활용한 한번의 쿼리로 데이터 가져오기. -> userStats활용
    @Query("""
    select new com.stats.dto.response.SpecificStatsDTO(
        us.createdAt,
        r.roomType,
        us.totalRank,
        us.dateSelectTime,
        us.seccodeSelectTime,
        us.seatSelectTime,
        us.dateSelectTime + us.seccodeSelectTime + us.seatSelectTime
    )
    from UserStats us
    join Match m on m.matchId = us.matchId
    join Room r  on r.id = m.roomId
    where us.userId = :userId
    order by us.createdAt desc
""")
    List<SpecificStatsDTO> findSpecificStatsWithRoom(@Param("userId") Long userId);

}
