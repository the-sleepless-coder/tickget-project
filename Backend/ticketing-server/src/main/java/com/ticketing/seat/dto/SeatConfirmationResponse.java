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
    private List<ConfirmedSeatDto> confirmedSeats;
    private String matchId;
    private String userId;
    private List<String> requestedSeats;
    private String status;
}