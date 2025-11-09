package com.ticketing.seat.concurrency;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Stream;

/**
 * 여러 좌석을 한 번에 선점(확정) 처리하고, 동시에 카운트를 원자적으로 증가시킨다.
 * Redis 키: seat:{matchId}:{sectionId}:{row-number}
 * Redis 값: {userId}:{grade}
 *
 * 반환값:
 * - 0: 실패 (좌석 이미 선점됨)
 * - 1: 성공 (일반)
 * - 2: 성공 + 만석으로 CLOSED 처리됨
 */
@Component
@RequiredArgsConstructor
public class LuaReservationExecutor {

    private final StringRedisTemplate redisTemplate;

    private final DefaultRedisScript<Long> reserveSeatsLuaScript = new DefaultRedisScript<>(
            """
            local seatCount = tonumber(ARGV[2])
            local totalSeats = tonumber(ARGV[3])
            local userIdGrade = ARGV[1]
            
            -- check phase: 모든 좌석이 비어있는지 확인
            for i = 1, seatCount do
                if redis.call('EXISTS', KEYS[i]) == 1 then
                    return 0
                end
            end
    
            -- assign phase: 모든 좌석을 userId:grade로 할당
            for i = 1, seatCount do
                redis.call('SET', KEYS[i], userIdGrade)
            end
            
            -- 카운터 증가
            local newCount = redis.call('INCRBY', KEYS[seatCount + 1], seatCount)
            
            -- 만석 체크: 전체 좌석에 도달하면 상태를 CLOSED로 자동 변경
            if newCount >= totalSeats then
                redis.call('SET', KEYS[seatCount + 2], 'CLOSED')
                return 2  -- 성공 + 만석으로 CLOSED 처리됨
            end
    
            return 1  -- 일반 성공
            """,
            Long.class
    );

    /**
     * 좌석 원자적 선점 처리
     * @param matchId 경기 ID
     * @param sectionId 섹션 ID
     * @param rowNumbers 행-번호 리스트 (예: ["9-15", "9-16"])
     * @param userId 사용자 ID
     * @param grade 좌석 등급
     * @param totalSeats 전체 좌석 수
     * @return 0: 실패, 1: 성공, 2: 성공+만석
     */
    public Long tryReserveSeatsAtomically(Long matchId,
                                          String sectionId,
                                          List<String> rowNumbers,
                                          Long userId,
                                          String grade,
                                          int totalSeats) {

        // KEYS: seat 키들 + reserved_count + status
        List<String> keys = Stream.of(
                rowNumbers.stream().map(rowNumber ->
                        "seat:" + matchId + ":" + sectionId + ":" + rowNumber),
                Stream.of("match:" + matchId + ":reserved_count"),
                Stream.of("match:" + matchId + ":status")
        ).flatMap(s -> s).toList();


        // ARGV[1]: userId:grade 형식
        String userIdGrade = userId + ":" + grade;

        Long result = redisTemplate.execute(
                reserveSeatsLuaScript,
                keys,
                userIdGrade,
                String.valueOf(rowNumbers.size()),
                String.valueOf(totalSeats)
        );

        return result;
    }
}