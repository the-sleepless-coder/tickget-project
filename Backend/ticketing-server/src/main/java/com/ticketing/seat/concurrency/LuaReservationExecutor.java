package com.ticketing.seat.concurrency;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/**
 * 여러 좌석을 한 번에 선점(Hold) 처리하고, 좌석 키에만 정보를 저장한다.
 * Redis 키:
 *   - seat:{matchId}:{sectionId}:{row-number}
 *   - match:{matchId}:status
 * Redis seat 값: {userId}:{grade}
 *
 * 반환값:
 * - 0: 실패 (좌석 이미 선점됨)
 * - 1: 성공
 *
 * 주의: Hold 시점에는 만석/카운트 체크를 하지 않음 (Confirm 시점에 처리)
 */
@Component
@RequiredArgsConstructor
public class LuaReservationExecutor {

    private final StringRedisTemplate redisTemplate;

    private static final int MATCH_REDIS_TTL_SECONDS = 1800; // 10분

    private final DefaultRedisScript<Long> reserveSeatsLuaScript = new DefaultRedisScript<>(
            """
                    local seatCount = tonumber(ARGV[1])
                    local userId = ARGV[2]
                    local ttl = tonumber(ARGV[3])
                    
                    -- KEYS[1..seatCount]     : seat 키들
                    -- KEYS[seatCount + 1]    : match status 키
                    
                    -- check phase: 모든 좌석이 비어있는지 확인
                    for i = 1, seatCount do
                        if redis.call('EXISTS', KEYS[i]) == 1 then
                            return 0  -- 좌석이 이미 선점됨
                        end
                    end
                    
                    -- assign phase: 각 좌석을 userId:grade로 할당하고 TTL 설정
                    for i = 1, seatCount do
                        local grade = ARGV[3 + i]  -- ARGV[4]부터 각 좌석의 grade
                        local userIdGrade = userId .. ':' .. grade
                        redis.call('SET', KEYS[i], userIdGrade)
                        redis.call('EXPIRE', KEYS[i], ttl)  -- 좌석 키에 TTL 설정 (10분)
                    end
                    
                    -- status 키를 OPEN으로 설정 + TTL 설정
                    local statusKeyIndex = seatCount + 1
                    redis.call('SET', KEYS[statusKeyIndex], 'OPEN')
                    redis.call('EXPIRE', KEYS[statusKeyIndex], ttl)
                    
                    return 1  -- 성공
                    """,
            Long.class
    );

    /**
     * 좌석 원자적 선점 처리 (각 좌석마다 다른 grade 가능)
     *
     * Hold 시점에는 만석 체크를 하지 않음
     * reserved_count는 사용하지 않음
     *
     * @param matchId    경기 ID
     * @param sectionId  섹션 ID (String - Redis 키용)
     * @param rowNumbers 행-번호 리스트 (예: ["9-15", "9-16"])
     * @param userId     사용자 ID
     * @param grades     각 좌석의 등급 리스트 (예: ["R석", "VIP"])
     * @param totalSeats 전체 좌석 수 (사용 안 함 - 하위 호환성 유지)
     * @return 0: 실패, 1: 성공
     */
    public Long tryReserveSeatsAtomically(Long matchId,
                                          String sectionId,
                                          List<String> rowNumbers,
                                          Long userId,
                                          List<String> grades,
                                          int totalSeats) {

        if (rowNumbers.size() != grades.size()) {
            throw new IllegalArgumentException("rowNumbers와 grades의 개수가 일치하지 않습니다.");
        }

        // KEYS: seat 키들 + status 키
        List<String> keys = Stream.of(
                rowNumbers.stream().map(rowNumber ->
                        "seat:" + matchId + ":" + sectionId + ":" + rowNumber),
                Stream.of("match:" + matchId + ":status")
        ).flatMap(s -> s).toList();

        // ARGV: [seatCount, userId, ttl, grade1, grade2, ...]
        List<String> args = new ArrayList<>();
        args.add(String.valueOf(rowNumbers.size()));       // ARGV[1]: seatCount
        args.add(String.valueOf(userId));                  // ARGV[2]: userId
        args.add(String.valueOf(MATCH_REDIS_TTL_SECONDS)); // ARGV[3]: ttl (10분)
        args.addAll(grades);                               // ARGV[4]~: 각 좌석의 grade

        return redisTemplate.execute(
                reserveSeatsLuaScript,
                keys,
                args.toArray()
        );
    }

    @Deprecated
    public Long tryReserveSeatsAtomically(Long matchId,
                                          String sectionId,
                                          List<String> rowNumbers,
                                          Long userId,
                                          String grade,
                                          int totalSeats) {
        List<String> grades = rowNumbers.stream()
                .map(r -> grade)
                .toList();

        return tryReserveSeatsAtomically(matchId, sectionId, rowNumbers, userId, grades, totalSeats);
    }
}
