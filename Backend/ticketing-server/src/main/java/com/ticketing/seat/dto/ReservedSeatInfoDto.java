package com.ticketing.seat.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReservedSeatInfoDto {
    private Long sectionId;     // 8
    private String seatId;      // "8-9-15"
    private String grade;       // "R석", "VIP"
}