package com.ticketing.seat.dto;

import lombok.*;

/**
 * 예매 실패 사용자 통계 저장 요청 DTO
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FailedStatsRequest {
    private Long userId;

    // 통계 데이터
    private Float dateSelectTime;
    private Integer dateMissCount;
    private Float seccodeSelectTime;
    private Integer seccodeBackspaceCount;
    private Integer seccodeTryCount;
    private Float seatSelectTime;
    private Integer seatSelectTryCount;
    private Integer seatSelectClickMissCount;
}