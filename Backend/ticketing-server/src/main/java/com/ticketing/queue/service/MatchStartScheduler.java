package com.ticketing.queue.service;

import com.ticketing.queue.DTO.MatchInsertedEventDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class MatchStartScheduler {
    private final ThreadPoolTaskScheduler taskScheduler;
    private final MatchStatusChanger changer; // 실행 로직 (아래)

    private static final int START_BEFORE_SECONDS = 10;

    // 시작 N초 전에 Scheduler를 이용해서,
    // Bot 호출, Redis 키 값 업데이트
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onInserted(MatchInsertedEventDTO e) {
        // 👉 “시작 10초 전”에 실행하려면
        LocalDateTime target = e.getStartedAt().minusSeconds(START_BEFORE_SECONDS);

        long delayMs = java.time.Duration.between(LocalDateTime.now(), target).toMillis();
        if (delayMs < 0) delayMs = 0;

        taskScheduler.schedule(
                () -> changer.runStartFlow(e.getMatchId(), e.getRoomId(), e.getStartedAt(), e.getBotCount(), e.getDifficulty(), e.getHallId() ),   // ← 여기서 로봇 호출까지 함
                java.time.Instant.now().plusMillis(delayMs)
        );
    }

}
