// 2. 이벤트 리스너 생성
package com.ticketing.seat.service;

import com.ticketing.seat.event.MatchEndEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class MatchEndEventListener {

    private final StatsServerClient statsServerClient;
    private final RoomServerClient roomServerClient;

    @Async  // 비동기로 처리 (선택)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)  // 커밋 후 실행
    public void handleMatchEnd(MatchEndEvent event) {
        log.info("트랜잭션 커밋 후 매치 종료 알림 전송: matchId={}", event.getMatchId());

        // 이 시점에는 모든 UserStats가 DB에 저장됨
        statsServerClient.notifyMatchEnd(event.getMatchId());
        roomServerClient.notifyMatchEnd(event.getRoomId());
    }
}