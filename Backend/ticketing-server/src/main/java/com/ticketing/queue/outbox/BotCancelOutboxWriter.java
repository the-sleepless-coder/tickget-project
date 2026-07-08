package com.ticketing.queue.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.entity.Outbox;
import com.ticketing.queue.service.QueueService;
import com.ticketing.repository.OutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 경기 취소 시 이미 준비된 봇 teardown(BOT_PREPARE_CANCELLED)을 Outbox 로 발행 보장.
 *
 * 호출자의 트랜잭션(경기 CANCELLED 저장) 안에서 outbox row를 함께 저장하므로
 * CANCELLED 와 원자적으로 커밋되고, 커밋 후 OutboxListener 가 즉시 발행한다.
 * (실패해도 OutboxRecoveryScheduler 가 재발행)
 *
 * ※ 반드시 활성 트랜잭션 안에서 호출할 것 — 트랜잭션 밖이면 즉시 발행 이벤트가 스킵되어
 *    스케줄러가 주울 때까지 지연된다. ([[RoomCancelOutboxWriter]] 와 동일 계약)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BotCancelOutboxWriter {
    private final OutboxRepository outboxRepository;
    private final ObjectMapper mapper;
    private final ApplicationEventPublisher eventPublisher;

    public void enqueue(Long matchId) {
        Outbox outbox = Outbox.builder()
                .aggregateType(Outbox.AggregateType.BOT)
                .aggregateId(matchId)
                .eventType(OutboxEventType.BOT_PREPARE_CANCELLED)
                .payload(buildPayload(matchId))
                .status(Outbox.OutboxStatus.PENDING)
                .retryCount(0)
                .createdTime(LocalDateTime.now())
                .build();
        outboxRepository.save(outbox);
        // 커밋 후 즉시 발행 (실패해도 OutboxRecoveryScheduler가 재발행)
        eventPublisher.publishEvent(new QueueService.OutboxCreatedEvent(outbox.getId()));
        log.info("봇 취소 outbox 저장: matchId={}", matchId);
    }

    private String buildPayload(Long matchId) {
        try {
            return mapper.writeValueAsString(Map.of("matchId", matchId));
        } catch (Exception e) {
            return "{\"matchId\":" + matchId + "}";
        }
    }
}
