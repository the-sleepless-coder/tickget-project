package com.ticketing.queue.outbox;

import com.ticketing.entity.Outbox;
import com.ticketing.queue.service.QueueService;
import com.ticketing.repository.OutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class OutboxListener {
    private final OutboxRepository outboxRepository;
    private final OutboxPublisher publisher;

    // 실행 시점 결정. (이전 DB커밋 이후 실행)
    // 독립 스레드에서 비동기로 실행
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void onOutboxCreated(QueueService.OutboxCreatedEvent event) {
        Outbox outbox = outboxRepository.findById(event.outboxId()).orElseThrow();
        // 생성된 빈을 통해 publish를 호출할 수 있게 함.
        // 프록시를 거쳐서 실행될 수 있게 함으로써,
        // Transactional이 실행될 수 있게 함.
        publisher.publish(outbox);
    }



}
