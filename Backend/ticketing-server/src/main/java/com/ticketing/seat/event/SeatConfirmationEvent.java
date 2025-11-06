package com.ticketing.seat.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SeatConfirmationEvent {

    private Long userId;
    private Long matchId;
    private List<String> seatIds;
    private List<String> sectionIds;

    // 통계 데이터를 위한 필드
    private long timestamp;
    private boolean success;
    private String message;
    private long selectionDurationMs;     // 좌석 선택에서 확정까지 걸린 시간
}