package com.ticketing.seat.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatConfirmationRequest {
    private Long userId;

    // 통계 데이터
    private Integer dateSelectTime;
    private Integer dateMissCount;
    private Integer seccodeSelectTime;
    private Integer seccodeBackspaceCount;
    private Integer seccodeTryCount;
    private Integer seatSelectTime;
    private Integer seatSelectTryCount;
    private Integer seatSelectClickMissCount;
}