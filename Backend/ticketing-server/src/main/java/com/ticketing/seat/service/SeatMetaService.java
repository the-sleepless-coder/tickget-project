package com.ticketing.seat.service;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.stereotype.Component;

@Component
public class SeatMetaService {

    public SeatMeta resolve(Long matchId, String seatId) {
        // TODO: preset_halls/room/좌석 규칙에 맞게 파싱/조회
        // 예: "A-12" -> section="A", grade="VIP" (샘플)
        String section = parseSection(seatId); // ex) "A"
        String grade   = resolveGrade(matchId, seatId); // ex) "VIP"
        return new SeatMeta(section, grade);
    }

    private String parseSection(String seatId) {
        int idx = seatId.indexOf('-');
        return (idx > 0) ? seatId.substring(0, idx) : "UNKNOWN";
    }

    private String resolveGrade(Long matchId, String seatId) {
        // TODO: matchId 기반 좌석 등급 조회 (rooms/preset_halls 테이블 등)
        return "UNKNOWN";
    }

    @Getter
    @AllArgsConstructor
    public static class SeatMeta {
        private final String sectionId;
        private final String grade;
    }
}
