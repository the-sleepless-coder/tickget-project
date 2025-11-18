package com.stats.repository;

import com.stats.dto.response.MatchData.MatchInfoStatsDTO;
import com.stats.dto.response.MatchData.MatchSpecificsStatsDTO;
import com.stats.dto.response.IndividualData.SpecificStatsDTO;
import com.stats.entity.Room;
import com.stats.entity.UserStats;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserStatsRepository extends JpaRepository<UserStats, Long> {
    // userId를 이용한 userStat 찾기.
    Optional<UserStats> findByUserId(Long userId);

    // matchId를 이용한 userStat 찾기.
    List<UserStats> findByMatchId(Long matchId);

    List<UserStats> findTop12ByUserIdOrderByCreatedAtDesc(Long userId);

    // 대결, 개인 모드 최근 5개 매치 가져오기.
    List<UserStats> findTop5ByUserIdOrderByCreatedAtDesc(Long userId);

    // 그냥 JPQL로 SQL문 때려박고 데이터 가져온다. -> specificsDTO활용
    // JPA스럽게 하려면 Lazy Fetch + Fetch Join을 활용한 한번의 쿼리로 데이터 가져오기. -> userStats활용
    @Query("""
    select new com.stats.dto.response.IndividualData.SpecificStatsDTO(
        us.createdAt,
        r.roomType,
        us.userRank,
        us.totalRank,
        m.userCount,
        r.botCount,
        us.dateSelectTime,
        us.seccodeSelectTime,
        us.seatSelectTime,
        us.dateSelectTime + us.seccodeSelectTime + us.seatSelectTime
    )
    from UserStats us
    join Match m on m.matchId = us.matchId
    join Room r  on r.id = m.roomId
    where us.userId = :userId
    and r.roomType = :roomType
    order by us.createdAt desc
""")
    List<SpecificStatsDTO> findSpecificStatsWithRoom(@Param("userId") Long userId,
                                                     @Param("roomType")Room.RoomType roomType,
                                                     Pageable pageable
                                                     );

    @Query("""
    select new com.stats.dto.response.MatchData.MatchInfoStatsDTO(
        m.id,
        m.matchName,
        r.roomType,
        m.userCount,
        h.name,
        r.isAIGenerated,
        m.difficulty,
        r.totalSeat,                
        m.usedBotCount,
        m.startedAt,
        us.isSuccess
    )
    from UserStats us
    left join Match m on m.matchId = us.matchId
    left join Room r  on r.id = m.roomId
    left join PresetHall h on h.id = r.hallId
    where us.userId = :userId
    and r.roomType = :roomType
    order by m.startedAt desc
""")
    List<MatchInfoStatsDTO> findMatchInfoStatsByUserId(@Param("userId") Long userId,
                                                       @Param("roomType")Room.RoomType roomType,
                                                       Pageable pageable);


    @Query("""
    select new com.stats.dto.response.MatchData.MatchSpecificsStatsDTO(
        us.userId,
        u.nickname,
        r.hallId,
        r.roomType,
        us.selectedSection,
        us.selectedSeat,
        us.userRank,
        us.totalRank,
        r.hallSize,
        r.tsxUrl,
        m.matchId,
        us.dateMissCount,
        us.dateSelectTime,
        us.seccodeBackspaceCount,
        us.seccodeSelectTime,
        us.seccodeTryCount,
        us.seatSelectClickMissCount,
        us.seatSelectTime,
        us.seatSelectTryCount,
        u.profileImageUrl
    )
    from UserStats us
    left join Match m on m.matchId = us.matchId
    left join Room r on r.id = m.roomId
    left join User u on u.id = us.userId
    where us.matchId = :matchId
    and r.roomType = :roomType
    order by m.startedAt desc
""")
    List<MatchSpecificsStatsDTO>findMatchSpecificInfoStatsByMatchId(@Param("matchId") Long matchId,
                                                                    @Param("roomType") Room.RoomType roomType
                                                                   );

    // 중복되지 않는 matchId, 내림차순.
    @Query("SELECT DISTINCT us.matchId FROM UserStats us ORDER BY us.matchId DESC")
    List<Long> findDistinctMatchIds();

    // 아직 집계 안된 matchId 확인.
    @Query("""
        SELECT DISTINCT us.matchId
        FROM UserStats us
        WHERE us.matchId NOT IN (
            SELECT ms.matchId FROM MatchStats ms
        )
        ORDER BY us.matchId DESC
        """)
    List<Long> findMatchIdsWithoutStats();

}
