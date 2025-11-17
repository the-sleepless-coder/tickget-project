package com.ticketing.seat.concurrency;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/**
 * 여러 좌석을 한 번에 선점(확정) 처리하고, 동시에 카운트를 원자적으로 증가시킨다.
 * Redis 키: seat:{matchId}:{sectionId}:{row-number}
 * Redis 값: {userId}:{grade}
 * <p>
 * 반환값:
 * - 0: 실패 (좌석 이미 선점됨)
 * - 1: 성공 (일반)
 * - 2: 성공 + 만석으로 CLOSED 처리됨
 */
@Component
@RequiredArgsConstructor
public class LuaReservationExecutor {

    private final StringRedisTemplate redisTemplate;

    private static final int MATCH_REDIS_TTL_SECONDS = 600; // 10분

    private final DefaultRedisScript<Long> reserveSeatsLuaScript = new DefaultRedisScript<>(
            """
                    local seatCount = tonumber(ARGV[1])
                    local totalSeats = tonumber(ARGV[2])
                    local userId = ARGV[3]
                    local ttl = tonumber(ARGV[4])
                    
                    -- check phase: 모든 좌석이 비어있는지 확인
                    for i = 1, seatCount do
                        if redis.call('EXISTS', KEYS[i]) == 1 then
                            return 0  -- 좌석이 이미 선점됨
                        end
                    end
                    
                    -- assign phase: 각 좌석을 userId:grade로 할당하고 TTL 설정
                    for i = 1, seatCount do
                        local grade = ARGV[4 + i]  -- ARGV[5]부터 각 좌석의 grade
                        local userIdGrade = userId .. ':' .. grade
                        redis.call('SET', KEYS[i], userIdGrade)
                        redis.call('EXPIRE', KEYS[i], ttl)  -- 좌석 키에 TTL 설정 (10분)
                    end
                    
                    -- count phase: reserved_count 증가 및 TTL 설정
                    local newCount = redis.call('INCRBY', KEYS[seatCount + 1], seatCount)
                    redis.call('EXPIRE', KEYS[seatCount + 1], ttl)  -- reserved_count TTL
                    
                    -- 만석 체크: 전체 좌석에 도달하면 상태를 CLOSED로 자동 변경
                    if newCount >= totalSeats then
                        redis.call('SET', KEYS[seatCount + 2], 'CLOSED')
                        redis.call('EXPIRE', KEYS[seatCount + 2], ttl)  -- CLOSED TTL
                        return 2  -- 성공 + 만석으로 CLOSED 처리됨
                    else
                        -- OPEN 상태일 때도 TTL 설정
                        redis.call('SET', KEYS[seatCount + 2], 'OPEN')
                        redis.call('EXPIRE', KEYS[seatCount + 2], ttl)  -- OPEN TTL
                    end
                    
                    return 1  -- 일반 성공
                    """,
            Long.class
    );

    /**
     * 좌석 원자적 선점 처리 (각 좌석마다 다른 grade 가능)
     *
     * @param matchId    경기 ID
     * @param sectionId  섹션 ID (String - Redis 키용)
     * @param rowNumbers 행-번호 리스트 (예: ["9-15", "9-16"])
     * @param userId     사용자 ID
     * @param grades     각 좌석의 등급 리스트 (예: ["R석", "VIP"])
     * @param totalSeats 전체 좌석 수
     * @return 0: 실패, 1: 성공, 2: 성공+만석
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

        // KEYS: seat 키들 + reserved_count + status
        List<String> keys = Stream.of(
                rowNumbers.stream().map(rowNumber ->
                        "seat:" + matchId + ":" + sectionId + ":" + rowNumber),
                Stream.of("match:" + matchId + ":reserved_count"),
                Stream.of("match:" + matchId + ":status")
        ).flatMap(s -> s).toList();

        // ARGV: [seatCount, totalSeats, userId, ttl, grade1, grade2, ...]
        List<String> args = new ArrayList<>();
        args.add(String.valueOf(rowNumbers.size()));       // ARGV[1]: seatCount
        args.add(String.valueOf(totalSeats));              // ARGV[2]: totalSeats
        args.add(String.valueOf(userId));                  // ARGV[3]: userId
        args.add(String.valueOf(MATCH_REDIS_TTL_SECONDS)); // ARGV[4]: ttl (10분)
        args.addAll(grades);                               // ARGV[5]~: 각 좌석의 grade

        Long result = redisTemplate.execute(
                reserveSeatsLuaScript,
                keys,
                args.toArray()
        );

        return result;
    }

    /**
     * 하위 호환성: 모든 좌석이 같은 grade를 가지는 경우
     *
     * @deprecated tryReserveSeatsAtomically(matchId, sectionId, rowNumbers, userId, grades, totalSeats) 사용 권장
     */
    @Deprecated
    public Long tryReserveSeatsAtomically(Long matchId,
                                          String sectionId,
                                          List<String> rowNumbers,
                                          Long userId,
                                          String grade,
                                          int totalSeats) {
        // 모든 좌석에 같은 grade 적용
        List<String> grades = rowNumbers.stream()
                .map(r -> grade)
                .toList();

        return tryReserveSeatsAtomically(matchId, sectionId, rowNumbers, userId, grades, totalSeats);
    }
}