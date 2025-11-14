package com.ticketing.seat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 경기 중간 퇴장 유저 알림 응답 DTO
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserLeftRoomResponse {
    private boolean success;
    private String message;
    private Long matchId;
    private Long userId;
    private int cancelledSeatCount;  // 취소된 좌석 수
    private boolean statusChangedToOpen;  // CLOSED → OPEN 복구 여부
}