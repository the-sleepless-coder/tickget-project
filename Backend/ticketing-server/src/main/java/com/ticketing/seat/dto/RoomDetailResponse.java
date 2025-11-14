package com.ticketing.seat.dto;

import lombok.*;


@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomDetailResponse {
    private Integer realUserCount;  // 실제 유저 수
    private Integer botCount;        // 봇 수
    private Integer totalSeats;      // 전체 좌석 수 (선택)
}