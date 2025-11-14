package com.ticketing.seat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 경기 중간 퇴장 유저 알림 요청 DTO
 * Room Server에서 전송
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserLeftRoomRequest {
    private Long roomId;
    private Long userId;
}