package com.ticketing.queue.DTO;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class QueueLogDTO {

    // Queue(예매 단계)에서 Log 정보 저장을 위한 DTO
    // 계층 간 넘나들 정보를 다 정의.
    String eventId;
    String roomId;
    String playerType;
    String playerId;
    Long queueRank;
    private int clickMiss;
    private int duration;

    //eventId만 따로 설정
    public void setEventId(UUID uuid){
        this.eventId = uuid.toString();
    }
}
