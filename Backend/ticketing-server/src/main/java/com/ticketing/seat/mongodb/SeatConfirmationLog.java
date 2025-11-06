package com.ticketing.seat.mongodb;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "seat_confirmation_logs")
public class SeatConfirmationLog {

    @Id
    private String id;

    private String eventType;
    private Long userId;
    private Long matchId;
    private List<String> seatIds;
    private List<String> sectionIds;
    private String eventId;
    private Date timestamp;
    private boolean success;
    private String message;

    // 성능 통계 데이터
    private Long selectionDurationMs;     // 좌석 선택에서 확정까지 걸린 시간

    // 추가 정보 (클라이언트 IP, 브라우저 등)
    private Map<String, Object> metadata;
}