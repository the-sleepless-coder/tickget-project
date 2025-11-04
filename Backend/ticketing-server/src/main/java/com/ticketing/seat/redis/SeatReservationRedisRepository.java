package com.ticketing.seat.redis;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class SeatReservationRedisRepository {

    private final StringRedisTemplate redisTemplate;

    /**
     * Redis 키 생성: seat:{matchId}:{sectionId}:{row-number}
     * 예: seat:100:008:9-15
     */
    private String seatKey(Long matchId, String sectionId, String rowNumber) {
        return "seat:" + matchId + ":" + sectionId + ":" + rowNumber;
    }

    /**
     * 단일 좌석을 userId와 grade로 선점 시도
     * Redis 값: {userId}:{grade}
     * 이미 누군가 있으면 false, 비어있으면 true
     */
    public boolean tryReserveSingleSeat(Long matchId, String sectionId, String rowNumber,
                                        Long userId, String grade) {
        String value = userId + ":" + grade;
        Boolean ok = redisTemplate
                .opsForValue()
                .setIfAbsent(seatKey(matchId, sectionId, rowNumber), value);
        return Boolean.TRUE.equals(ok);
    }

    /**
     * 좌석 점유자 및 등급 조회
     * @return Optional<SeatOwnerInfo> (userId, grade)
     */
    public Optional<SeatOwnerInfo> findOwnerWithGrade(Long matchId, String sectionId, String rowNumber) {
        String val = redisTemplate.opsForValue().get(seatKey(matchId, sectionId, rowNumber));
        if (val == null) return Optional.empty();

        String[] parts = val.split(":");
        if (parts.length != 2) return Optional.empty();

        return Optional.of(new SeatOwnerInfo(Long.valueOf(parts[0]), parts[1]));
    }

    /**
     * 좌석 점유자만 조회 (기존 호환성 유지)
     */
    public Optional<Long> findOwner(Long matchId, String sectionId, String rowNumber) {
        return findOwnerWithGrade(matchId, sectionId, rowNumber)
                .map(SeatOwnerInfo::getUserId);
    }

    /**
     * 좌석 해제(청소용)
     */
    public void releaseSeat(Long matchId, String sectionId, String rowNumber) {
        redisTemplate.delete(seatKey(matchId, sectionId, rowNumber));
    }

    /**
     * 좌석 소유자 정보
     */
    @lombok.Getter
    @lombok.AllArgsConstructor
    public static class SeatOwnerInfo {
        private final Long userId;
        private final String grade;
    }
}