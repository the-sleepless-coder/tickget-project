package com.ticketing.seat.dto;

import lombok.*;

/**
 * 예매 실패 사용자 통계 저장 응답 DTO
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FailedStatsResponse {
    private Boolean success;
}