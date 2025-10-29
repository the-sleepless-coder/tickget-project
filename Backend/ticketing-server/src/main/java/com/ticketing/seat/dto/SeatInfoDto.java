package com.ticketing.seat.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatInfoDto {
    private String sectionId;   // "A"
    private String seatId;      // "A-12"
    private String grade;       // "VIP"
    private String expiresAt;   // "2025-10-29T09:12:33.123Z" (성공 응답일 때만 사용, 실패엔 null 가능)
}
