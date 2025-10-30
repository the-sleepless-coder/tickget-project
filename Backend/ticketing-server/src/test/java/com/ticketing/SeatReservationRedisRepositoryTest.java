package com.ticketing;

import com.ticketing.seat.redis.SeatReservationRedisRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.AssertionsForClassTypes.assertThat;

@SpringBootTest
class SeatReservationRedisRepositoryTest {

    @Autowired
    SeatReservationRedisRepository repo;

    @Test
    void 좌석_선점_키_남겨두기() {
        Long matchId = 100L;
        String seatId = "A-10";
        Long userId  = 1L;

        // 선점 (키 생성)
        boolean ok = repo.tryReserveSingleSeat(matchId, seatId, userId);
        assertThat(ok).isTrue();

        // 👇 지우지 말고 남겨둠 (releaseSeat 호출 X)
        assertThat(repo.findOwner(matchId, seatId)).contains(userId);
    }
}
