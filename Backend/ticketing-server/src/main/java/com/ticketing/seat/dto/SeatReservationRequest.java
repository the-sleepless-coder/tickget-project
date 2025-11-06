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
    private List<String> seatIds;
    private String sectionId;
    private String grade;
    private Long matchId;
}
