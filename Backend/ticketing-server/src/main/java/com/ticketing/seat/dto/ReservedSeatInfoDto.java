package com.ticketing.seat.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReservedSeatInfoDto {
    private String sectionId;   // "8" (섹션 번호를 문자열로)
    private String seatId;      // "8-9-15" (섹션-행-열)
    private String grade;       // "R석", "VIP"
    private Long matchId;
}