package com.ticketing.queue.outbox;


import com.ticketing.KafkaTopic;
import com.ticketing.entity.Outbox;
import com.ticketing.repository.OutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class OutboxPublisher {
    private final OutboxRepository outboxRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    // Kafka 이벤트 발행과 상태 저장을 하나의 transaction으로 묶음.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void publish(Outbox outbox) {
        String topic = resolveTopic(outbox.getEventType());
        try {
            // Kafka에 이벤트 발행 (토픽, 키, 페이로드)
            kafkaTemplate.send(topic,
                    String.valueOf(outbox.getAggregateId()),
                    outbox.getPayload()   // JSON 문자열 그대로 전송
            ).get();
            outbox.setStatus(Outbox.OutboxStatus.PUBLISHED);
            outbox.setPublishedAt(LocalDateTime.now());

        } catch (Exception e) {
            log.error("Kafka 발행 실패, PENDING 유지: id={}, topic={}", outbox.getId(), topic, e);
            // PENDING 유지 → Recovery가 처리
        } finally {
            // Kafka 발행 상태를 outbox 테이블에 저장.
            outboxRepository.save(outbox);
        }

    }

    // eventType에 따라 발행 토픽 결정 (봇 요청 / 봇 취소 teardown / room 취소 통지)
    private String resolveTopic(String eventType) {
        return switch (eventType) {
            case OutboxEventType.BOT_PREPARE_CANCELLED -> KafkaTopic.MATCH_BOT_CANCELLED.getTopicName();
            case OutboxEventType.ROOM_MATCH_CANCELLED -> KafkaTopic.MATCH_ROOM_CANCELLED.getTopicName();
            case OutboxEventType.BOT_PREPARE_REQUESTED -> KafkaTopic.MATCH_BOT_REQUESTED.getTopicName();
            default -> throw new IllegalArgumentException("알 수 없는 Outbox eventType: " + eventType);
        };
    }


}
