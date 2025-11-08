package com.ticketing.seat.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatReservationRequest {
    private Long userId;
    private List<SeatInfo> seats;
    private String grade;
    private Integer totalSeats;

    /**
     * 첫 번째 좌석의 sectionId 반환 (내부 헬퍼 메서드)
     */
    public String extractSectionId() {  // ← get으로 시작하지 않음
        return seats != null && !seats.isEmpty()
                ? seats.get(0).getSectionId().toString()
                : "";
    }
}