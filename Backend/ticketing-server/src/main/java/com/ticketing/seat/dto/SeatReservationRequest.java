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
    private List<SeatInfo> seats;  // 프론트에서 받음
    private String grade;
    private Long matchId;
    private Integer totalSeats;

    /**
     * 첫 번째 좌석의 sectionId 반환
     */
    public String getSectionIdString() {
        return seats != null && !seats.isEmpty()
                ? seats.get(0).getSectionId().toString()
                : "";
    }
}