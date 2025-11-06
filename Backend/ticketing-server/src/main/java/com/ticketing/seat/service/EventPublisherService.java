package com.ticketing.seat.service;

import com.ticketing.seat.event.SeatConfirmationEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * 카프카 이벤트 발행을 담당하는 서비스
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EventPublisherService {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    /**
     * 좌석 확정 이벤트 발행
     */
    public void publishSeatConfirmationEvent(
            Long userId,
            Long matchId,
            List<String> seatIds,
            List<String> sectionIds,
            boolean success,
            String message,
            long selectionDurationMs) {

        SeatConfirmationEvent event = SeatConfirmationEvent.builder()
                .userId(userId)
                .matchId(matchId)
                .seatIds(seatIds)
                .sectionIds(sectionIds)
                .timestamp(System.currentTimeMillis())
                .success(success)
                .message(message)
                .selectionDurationMs(selectionDurationMs)
                .build();

        // 비동기적으로 이벤트 발행
        CompletableFuture<SendResult<String, Object>> future =
                kafkaTemplate.send("match.seat.confirmed", userId.toString(), event);

        future.whenComplete((result, ex) -> {
            if (ex != null) {
                log.error("Unable to send seat confirmation event to topic: {}", ex.getMessage());
            } else {
                log.debug("Sent seat confirmation event to topic [match.seat.confirmed] with offset: {}",
                        result.getRecordMetadata().offset());
            }
        });
    }

    /**
     * 좌석 선택 이벤트 발행
     */
    public void publishSeatSelectionEvent(
            Long userId,
            Long matchId,
            String seatId,
            String sectionId,
            long selectionTimeMs) {

        // 좌석 선택 이벤트 로직 (필요시 구현)
    }
}