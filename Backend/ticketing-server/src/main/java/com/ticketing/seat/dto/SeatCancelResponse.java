package com.ticketing.seat.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatCancelResponse {
    private boolean success;
    private String message;
    private Long matchId;
    private Long userId;
    private int cancelledSeatCount;
}