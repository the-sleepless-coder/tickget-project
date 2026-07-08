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
 * 경기 취소 시 room 서버 통지를 best-effort HTTP 대신 Outbox 이벤트로 발행 보장.
 *
 * 호출자의 트랜잭션(경기 CANCELLED 저장) 안에서 outbox row를 함께 저장하므로
 * "DB는 취소됐는데 room 통지만 유실"되는 이중 쓰기 문제가 사라진다.
 * 커밋 후 OutboxListener가 즉시 발행하고, 실패해도 OutboxRecoveryScheduler가 재발행한다.
 *
 * aggregateId 는 roomId(파티션 키 = room 단위 순서 보장), payload 에 matchId/roomId 를 담는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RoomCancelOutboxWriter {
    private final OutboxRepository outboxRepository;
    private final ObjectMapper mapper;
    private final ApplicationEventPublisher eventPublisher;

    public void enqueue(Long matchId, Long roomId) {
        Outbox outbox = Outbox.builder()
                .aggregateType(Outbox.AggregateType.ROOM)
                .aggregateId(roomId)
                .eventType(OutboxEventType.ROOM_MATCH_CANCELLED)
                .payload(buildPayload(matchId, roomId))
                .status(Outbox.OutboxStatus.PENDING)
                .retryCount(0)
                .createdTime(LocalDateTime.now())
                .build();
        outboxRepository.save(outbox);
        // 커밋 후 즉시 발행 (실패해도 OutboxRecoveryScheduler가 재발행)
        eventPublisher.publishEvent(new QueueService.OutboxCreatedEvent(outbox.getId()));
        log.info("room 취소 outbox 저장: matchId={}, roomId={}", matchId, roomId);
    }

    private String buildPayload(Long matchId, Long roomId) {
        try {
            return mapper.writeValueAsString(Map.of("matchId", matchId, "roomId", roomId));
        } catch (Exception e) {
            return "{\"matchId\":" + matchId + ",\"roomId\":" + roomId + "}";
        }
    }
}