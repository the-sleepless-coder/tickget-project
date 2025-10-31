package com.ticketing.seat.concurrency;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Stream;

/**
 * 여러 좌석을 한 번에 선점(확정) 처리하고, 동시에 카운트를 원자적으로 증가시킨다.
 * - 모든 좌석이 아직 점유되지 않은 경우에만 전체 좌석을 userId로 할당한다.
 * - 하나라도 이미 점유된 좌석이 있다면 아무것도 쓰지 않고 실패(0)로 리턴한다.
 * - 성공 시 match:{matchId}:reserved_count 카운터를 증가시킨다.
 *
 * Redis에서 Lua는 단일 명령처럼 실행되므로 이 작업은 원자적이다.
 *
 * 리턴값:
 *   1 = 전체 성공 (좌석 전부 userId로 할당됨 + 카운트 증가)
 *   0 = 실패 (이미 점유된 좌석 존재, 어떤 것도 할당되지 않음)
 */
@Component
@RequiredArgsConstructor
public class LuaReservationExecutor {

    private final StringRedisTemplate redisTemplate;

    private final DefaultRedisScript<Long> reserveSeatsLuaScript = new DefaultRedisScript<>(
            """
            local seatCount = tonumber(ARGV[2])
            local totalSeats = tonumber(ARGV[3])
            
            -- check phase: 모든 좌석이 비어있는지 확인
            for i = 1, seatCount do
                if redis.call('EXISTS', KEYS[i]) == 1 then
                    return 0
                end
            end
    
            -- assign phase: 모든 좌석을 userId로 할당
            for i = 1, seatCount do
                redis.call('SET', KEYS[i], ARGV[1])
            end
            
            -- 카운터 증가
            local newCount = redis.call('INCRBY', KEYS[seatCount + 1], seatCount)
            
            -- 만석 체크: 전체 좌석에 도달하면 상태를 CLOSED로 자동 변경
            if newCount >= totalSeats then
                redis.call('SET', KEYS[seatCount + 2], 'CLOSED')
            end
    
            return 1
            """,
            Long.class
    );

    public boolean tryReserveSeatsAtomically(Long matchId,
                                             List<String> seatIds,
                                             Long userId,
                                             int totalSeats) {

        // KEYS: seat 키들 + reserved_count + status
        List<String> keys = Stream.of(
                seatIds.stream().map(seatId -> "seat:" + matchId + ":" + seatId),
                Stream.of("match:" + matchId + ":reserved_count"),
                Stream.of("match:" + matchId + ":status")
        ).flatMap(s -> s).toList();

        Long result = redisTemplate.execute(
                reserveSeatsLuaScript,
                keys,
                userId.toString(),
                String.valueOf(seatIds.size()),
                String.valueOf(totalSeats)
        );

        return result != null && result == 1L;
    }
}