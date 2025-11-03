package com.ticketing.seat.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReservedSeatInfoDto {
    private String sectionId;   // "A"
    private String seatId;      // "A-12"
    private String grade;       // "VIP"
    private Long matchId;
}
