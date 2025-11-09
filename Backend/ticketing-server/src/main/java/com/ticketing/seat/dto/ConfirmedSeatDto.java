package com.ticketing.seat.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConfirmedSeatDto {
    private String seatId;      // "8-9-15"
    private String sectionId;   // "8"
}