package com.ticketing.seat.concurrency;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 여러 좌석을 한 번에 선점(확정) 처리한다.
 * - 모든 좌석이 아직 점유되지 않은 경우에만 전체 좌석을 userId로 할당한다.
 * - 하나라도 이미 점유된 좌석이 있다면 아무것도 쓰지 않고 실패(0)로 리턴한다.
 *
 * Redis에서 Lua는 단일 명령처럼 실행되므로 이 작업은 원자적이다.
 *
 * 리턴값:
 *   1 = 전체 성공 (좌석 전부 userId로 할당됨)
 *   0 = 실패 (이미 점유된 좌석 존재, 어떤 것도 할당되지 않음)
 */
@Component
@RequiredArgsConstructor
public class LuaReservationExecutor {

    private final StringRedisTemplate redisTemplate;

    // 실제 Lua 스크립트
    //
    // KEYS = [ seat:{matchId}:{seat1}, seat:{matchId}:{seat2}, ... ]
    // ARGV[1] = userId (string)
    //
    // 1) 모든 좌석이 비어있는지 검사 (EXISTS == 0인지 확인)
    // 2) 하나라도 이미 있으면 즉시 return 0
    // 3) 전부 비어있으면 각 좌석을 userId로 SET
    // 4) return 1
    //
    private final DefaultRedisScript<Long> reserveSeatsLuaScript = new DefaultRedisScript<>(
            """
            -- check phase: ensure all seats are still free
            for i = 1, #KEYS do
                if redis.call('EXISTS', KEYS[i]) == 1 then
                    return 0
                end
            end
    
            -- assign phase: lock all seats to this user
            for i = 1, #KEYS do
                redis.call('SET', KEYS[i], ARGV[1])
            end
    
            return 1
            """,
            Long.class
    );

    /**
     * @param matchId  경기 ID
     * @param seatIds  사용자가 요청한 좌석 리스트
     * @param userId   이 좌석들을 확보하려는 사용자 ID
     * @return true if success (all seats locked by userId), false otherwise
     */
    public boolean tryReserveSeatsAtomically(Long matchId,
                                             List<String> seatIds,
                                             Long userId) {

        // Redis KEYS 목록 구성
        // seat:{matchId}:{seatId}
        List<String> keys = seatIds.stream()
                .map(seatId -> "seat:" + matchId + ":" + seatId)
                .toList();

        Long result = redisTemplate.execute(
                reserveSeatsLuaScript,
                keys,
                userId.toString()
        );

        return result != null && result == 1L;
    }
}
