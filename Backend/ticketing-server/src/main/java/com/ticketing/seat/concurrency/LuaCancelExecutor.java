package com.ticketing.seat.concurrency;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/**
 * 좌석 취소를 원자적으로 처리하는 Lua 스크립트 실행기
 *
 * 반환값:
 * - 0: 실패 (좌석이 해당 유저 소유 아님 / 좌석 없음)
 * - 1: 성공
 */
@Component
@RequiredArgsConstructor
public class LuaCancelExecutor {

    private final StringRedisTemplate redisTemplate;

    private static final int MATCH_REDIS_TTL_SECONDS = 1800; // 30분

    private final DefaultRedisScript<Long> cancelSeatsLuaScript = new DefaultRedisScript<>(
            """
                    local seatCount = tonumber(ARGV[1])
                    local userId = ARGV[2]
                    local ttl = tonumber(ARGV[3])
                    
                    -- 소유권 확인: 모든 좌석이 해당 userId 소유인지 확인
                    for i = 1, seatCount do
                        local value = redis.call('GET', KEYS[i])
                        if not value then
                            return 0  -- 좌석 없음
                        end
                    
                        -- userId:grade 형식에서 userId 추출
                        local ownerId = string.match(value, "^([^:]+):")
                        if ownerId ~= userId then
                            return 0  -- 다른 유저 소유
                        end
                    end
                    
                    -- 모든 좌석 삭제
                    for i = 1, seatCount do
                        redis.call('DEL', KEYS[i])
                    end
                    
                    -- status 키 TTL 갱신
                    redis.call('EXPIRE', KEYS[seatCount + 1], ttl)
                    
                    return 1  -- 성공
                    """,
            Long.class
    );

    /**
     * 좌석 원자적 취소 처리
     *
     * @param matchId    경기 ID
     * @param sectionId  섹션 ID (String - Redis 키용)
     * @param rowNumbers 행-번호 리스트 (예: ["9-15", "9-16"])
     * @param userId     사용자 ID
     * @param totalSeats 전체 좌석 수 (사용 안 함 - 하위 호환성 유지)
     * @return 0: 실패, 1: 성공
     */
    public Long tryCancelSeatsAtomically(Long matchId,
                                         String sectionId,
                                         List<String> rowNumbers,
                                         Long userId,
                                         int totalSeats) {

        // KEYS: seat 키들 + status
        List<String> keys = Stream.of(
                rowNumbers.stream().map(rowNumber ->
                        "seat:" + matchId + ":" + sectionId + ":" + rowNumber),
                Stream.of("match:" + matchId + ":status")
        ).flatMap(s -> s).toList();

        // ARGV: [seatCount, userId, ttl]
        List<String> args = new ArrayList<>();
        args.add(String.valueOf(rowNumbers.size()));       // ARGV[1]: seatCount
        args.add(String.valueOf(userId));                  // ARGV[2]: userId
        args.add(String.valueOf(MATCH_REDIS_TTL_SECONDS)); // ARGV[3]: ttl (10분)

        Long result = redisTemplate.execute(
                cancelSeatsLuaScript,
                keys,
                args.toArray()
        );

        return result;
    }
}