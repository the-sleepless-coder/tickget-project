package com.ticketing.seat.consumer;

import com.ticketing.seat.event.SeatConfirmationEvent;
import com.ticketing.seat.mongodb.SeatConfirmationLog;
import com.ticketing.seat.mongodb.SeatConfirmationLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * Kafka에서 좌석 확정 이벤트를 소비하고 MongoDB에 로그를 저장하는 컴포넌트
 * 통계 서버는 이 데이터를 조회하여 분석 및 통계를 생성합니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StatisticsEventConsumer {

    private final MongoTemplate mongoTemplate; // (미사용 경고만 있음, 유지)
    private final SeatConfirmationLogRepository logRepository;

    /**
     * 좌석 확정 이벤트 수신 및 MongoDB 저장
     * 수동 커밋(ack) 기반: 처리 성공 시에만 오프셋 커밋
     */
    @KafkaListener(
            topics = "match.seat.confirmed",
            groupId = "${spring.kafka.consumer.group-id:ticketing-service}",
            containerFactory = "kafkaListenerContainerFactory"
    )
    public void consumeSeatConfirmationEvent(SeatConfirmationEvent event, Acknowledgment ack) {
        try {
            log.debug("Received seat confirmation event for MongoDB storage: matchId={}, userId={}, seats={}",
                    event.getMatchId(), event.getUserId(), event.getSeatIds());

            // MongoDB에 로그 저장
            SeatConfirmationLog savedLog = logRepository.save(convertToLogEntry(event));
            log.info("Successfully saved seat confirmation event to MongoDB: id={}, matchId={}, userId={}",
                    savedLog.getId(), savedLog.getMatchId(), savedLog.getUserId());

            // ✅ 처리 성공 → 수동 커밋
            ack.acknowledge();

        } catch (Exception e) {
            // ❌ 실패 시 커밋하지 않음 → 재시도/백오프 또는 DLT로 이어짐(추후 정책)
            log.error("Error saving seat confirmation event to MongoDB: matchId={}, error={}",
                    event.getMatchId(), e.getMessage(), e);
            throw e;
        }
    }

    /**
     * 이벤트를 MongoDB 문서로 변환
     */
    private SeatConfirmationLog convertToLogEntry(SeatConfirmationEvent event) {
        return SeatConfirmationLog.builder()
                .eventType("SEAT_CONFIRMED")
                .userId(event.getUserId())
                .matchId(event.getMatchId())
                .seatIds(event.getSeatIds())
                .sectionIds(event.getSectionIds())
                .timestamp(new Date(event.getTimestamp()))
                .success(event.isSuccess())
                .message(event.getMessage())
                .selectionDurationMs(event.getSelectionDurationMs())
                .metadata(createMetadata(event))
                .build();
    }

    /**
     * 추가 메타데이터 생성 (간단 집계 보조 정보)
     */
    private Map<String, Object> createMetadata(SeatConfirmationEvent event) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("processingTime", System.currentTimeMillis());
        metadata.put("processingNode", getHostName());
        // 시간대별 집계를 위한 정보(간단 버전; Date API 사용 유지)
        metadata.put("hourOfDay", new Date(event.getTimestamp()).getHours());
        metadata.put("dayOfWeek", new Date(event.getTimestamp()).getDay());
        return metadata;
    }

    private String getHostName() {
        try {
            return java.net.InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            return "unknown";
        }
    }
}
