package com.ticketing.seat.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatConfirmationResponse {
    private boolean success;
    private String message;
    private Integer userRank;
    private List<ConfirmedSeatDto> confirmedSeats;
    private Long matchId;           // ← String에서 Long으로 변경
    private Long userId;            // ← String에서 Long으로 변경
    private String status;
}