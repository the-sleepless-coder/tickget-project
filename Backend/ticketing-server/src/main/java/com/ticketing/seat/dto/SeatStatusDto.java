package com.ticketing.seat.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatStatusDto {
    private String seatId;
    private String grade;
    private String status;  // AVAILABLE, MY_RESERVED, TAKEN
}