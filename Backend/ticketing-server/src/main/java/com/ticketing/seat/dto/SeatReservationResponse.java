package com.ticketing.seat.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatReservationResponse {

    private boolean success;
    private List<ReservedSeatInfoDto> heldSeats;
    private List<ReservedSeatInfoDto> failedSeats;
    private String message;
}
