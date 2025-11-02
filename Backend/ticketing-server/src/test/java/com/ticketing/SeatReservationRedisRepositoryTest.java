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
        String sectionId = "008";
        String rowNumber = "9-15";
        Long userId = 1L;
        String grade = "R석";

        // 선점 (키 생성): seat:100:008:9-15 → "1:R석"
        boolean ok = repo.tryReserveSingleSeat(matchId, sectionId, rowNumber, userId, grade);
        assertThat(ok).isTrue();

        // 소유자 확인
        assertThat(repo.findOwner(matchId, sectionId, rowNumber)).contains(userId);

        // 소유자 + 등급 확인
        var ownerInfo = repo.findOwnerWithGrade(matchId, sectionId, rowNumber);
        assertThat(ownerInfo).isPresent();
        assertThat(ownerInfo.get().getUserId()).isEqualTo(userId);
        assertThat(ownerInfo.get().getGrade()).isEqualTo(grade);
    }
}