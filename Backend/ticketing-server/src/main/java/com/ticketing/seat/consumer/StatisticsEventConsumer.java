package com.ticketing.seat.consumer;

import com.ticketing.seat.event.SeatConfirmationEvent;
import com.ticketing.seat.mongodb.SeatConfirmationLog;
import com.ticketing.seat.mongodb.SeatConfirmationLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.kafka.annotation.KafkaListener;
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

    private final MongoTemplate mongoTemplate;
    private final SeatConfirmationLogRepository logRepository;

    /**
     * 좌석 확정 이벤트 수신 및 MongoDB 저장
     * 통계 서버가 나중에 이 데이터를 조회할 수 있도록 합니다.
     */
    @KafkaListener(topics = "match.seat.confirmed", groupId = "${spring.kafka.consumer.group-id:ticketing-service}")
    public void consumeSeatConfirmationEvent(SeatConfirmationEvent event) {
        try {
            log.debug("Received seat confirmation event for MongoDB storage: matchId={}, userId={}, seats={}",
                    event.getMatchId(), event.getUserId(), event.getSeatIds());

            // MongoDB에 로그 저장
            SeatConfirmationLog logEntry = convertToLogEntry(event);
            SeatConfirmationLog savedLog = logRepository.save(logEntry);

            log.info("Successfully saved seat confirmation event to MongoDB: id={}, matchId={}, userId={}",
                    savedLog.getId(), savedLog.getMatchId(), savedLog.getUserId());

        } catch (Exception e) {
            // 실패해도 다른 이벤트 처리에 영향을 주지 않도록 예외 처리
            log.error("Error saving seat confirmation event to MongoDB: matchId={}, error={}",
                    event.getMatchId(), e.getMessage(), e);

            // 필요시 여기에 실패한 이벤트 복구 로직 추가
            // (예: 별도 큐에 저장 후 재시도 스케줄링)
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
     * 추가 메타데이터 생성
     * 통계에 유용한 정보를 여기에 추가할 수 있습니다.
     */
    private Map<String, Object> createMetadata(SeatConfirmationEvent event) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("processingTime", System.currentTimeMillis());
        metadata.put("processingNode", getHostName());

        // 시간대별 집계를 위한 정보 추가
        metadata.put("hourOfDay", new Date(event.getTimestamp()).getHours());
        metadata.put("dayOfWeek", new Date(event.getTimestamp()).getDay());

        return metadata;
    }

    /**
     * 처리 노드 이름 얻기
     */
    private String getHostName() {
        try {
            return java.net.InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            return "unknown";
        }
    }
}