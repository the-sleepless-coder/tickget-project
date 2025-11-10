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
    private float dateSelectTime;
    private Integer dateMissCount;
    private float seccodeSelectTime;
    private Integer seccodeBackspaceCount;
    private Integer seccodeTryCount;
    private float seatSelectTime;
    private Integer seatSelectTryCount;
    private Integer seatSelectClickMissCount;
}