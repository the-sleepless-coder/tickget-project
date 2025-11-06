package com.ticketing.queue.DTO;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class QueueDTO {

    // Queue 대기열 정보 전달을 위한 DTO
    String eventId;
    String matchId;
    String playerType;
    String playerId;
    String status;
    long positionAhead;
    long positionBehind;
    Long totalNum;

    // private Instant occuredAt;   // 클라이언트 송신 시각
    // private Instant receivedAt;  // 서버 수신 시각
    // boolean seatRemain;           // 좌석 남았는지 여부는 다른 곳에 넣어야할듯-> Redis에서 읽어와도 되지 않나? 어차피 사용자만 알면 돼서 말이야.

}
