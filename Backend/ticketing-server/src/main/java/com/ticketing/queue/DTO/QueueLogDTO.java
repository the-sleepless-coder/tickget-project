package com.ticketing.queue.DTO;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.mapping.Unwrapped;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QueueLogDTO {

    // Queue(예매 단계)에서 Log 정보 저장을 위한 DTO
    // 계층 간 넘나들 정보를 다 정의.
    String eventId;
    Long matchId;
    String playerType;
    String playerId;
    String status;
    long positionAhead;
    long positionBehind;
    Long totalNum;

    // QueueUserInfo
    int clickMiss;
    float duration;
    private LocalDateTime timeStamp;

    // 객체 생성 Builder
    public static QueueLogDTO of(String eventId, Long matchId, String playerType, String playerId, String status, long positionAhead, long positionBehind, Long totalNum, int clickMiss, float duration, LocalDateTime timeStamp){
        return QueueLogDTO.builder()
                .eventId(eventId)
                .matchId(matchId)
                .playerType(playerType)
                .playerId(playerId)
                .status(status)
                .positionAhead(positionAhead)
                .positionBehind(positionBehind)
                .totalNum(totalNum)
                .clickMiss(clickMiss)
                .duration(duration)
                .timeStamp(timeStamp)
                .build();
    }

    public void setEventId(String uuidString) {
        this.eventId = uuidString;
    }

}
