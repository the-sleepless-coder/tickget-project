// 1. 이벤트 클래스 생성
package com.ticketing.seat.event;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class MatchEndEvent {
    private final Long matchId;
    private final Long roomId;
}