package com.ticketing.seat.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatStatusDto {
    private String seatId;  // "8-9-15"
    private String grade;   // "R석", "VIP"
    private String status;  // AVAILABLE, MY_RESERVED, TAKEN
}