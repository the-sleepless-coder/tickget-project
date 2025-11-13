package com.ticketing.queue.Kafka;


import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class KafkaLogDLT {
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @KafkaListener(
            id = "userLogDltListener",
            topics = "user-log.DLT",
            groupId = "user-log-dlt-replayer",
            concurrency = "1" // 천천히/안전하게
    )
    public void onDltMessage(ConsumerRecord<String, Object> rec, Acknowledgment ack) {
        // 1) DLT 헤더로 원본 정보 확인
        String originalTopic = getHeader(rec, KafkaHeaders.DLT_ORIGINAL_TOPIC);
        Integer originalPartition = getHeaderInt(rec, KafkaHeaders.DLT_ORIGINAL_PARTITION);
        Long originalOffset = getHeaderLong(rec, KafkaHeaders.DLT_ORIGINAL_OFFSET);
        String exMsg = getHeader(rec, KafkaHeaders.DLT_EXCEPTION_MESSAGE);

        log.warn("♻️ DLT 재처리 시도: topic={} partition={} offset={} ex={}",
                originalTopic, originalPartition, originalOffset, exMsg);

        try {
            // 2) 재처리 전략
            // (A) 원래 비즈니스 로직을 여기서 다시 수행하거나
            // (B) 원래 토픽으로 재게시(re-publish)하여 정상 컨슈머가 다시 처리하게 함
            //    - 필요하면 재시도 횟수 헤더 관리
            ProducerRecord<String, Object> replay = rebuildOriginalRecord(rec, originalTopic);
            kafkaTemplate.send(replay).get(); // 동기 확인(원하면 비동기로 전환)

            ack.acknowledge(); // DLT 컨슈머 커밋
        } catch (Exception e) {
            log.error("❌ DLT 재처리 실패 - 보류/로그적재/알림 등 운영정책", e);
            // 재시도 루프 방지를 위해 ack은 상황에 따라 결정
            // (여기선 메시지 홀딩을 위해 ack 생략 가능; 또는 별도 보류 토픽으로 이동)
        }
    }

    private String getHeader(ConsumerRecord<?, ?> rec, String headerKey) {
        var h = rec.headers().lastHeader(headerKey);
        return (h == null) ? null : new String(h.value());
    }
    private Integer getHeaderInt(ConsumerRecord<?, ?> rec, String k) {
        String s = getHeader(rec, k); return (s == null) ? null : Integer.valueOf(s);
    }
    private Long getHeaderLong(ConsumerRecord<?, ?> rec, String k) {
        String s = getHeader(rec, k); return (s == null) ? null : Long.valueOf(s);
    }

    private ProducerRecord<String, Object> rebuildOriginalRecord(ConsumerRecord<String, Object> rec, String originalTopic) {
        // 원본 key/value 재사용 + 헤더 복사(불필요/민감 헤더는 제외)
        ProducerRecord<String, Object> pr = new ProducerRecord<>(originalTopic, rec.key(), rec.value());
        rec.headers().forEach(h -> {
            // 재처리용으로 안 넘길 헤더는 필터링 (예: DLT_* 헤더)
            String hk = h.key();
            if (!hk.startsWith("kafka_dlt-")) {
                pr.headers().add(hk, h.value());
            }
        });
        // 수동 재시도 횟수 헤더 갱신(무한 루프 방지)
        int retry = parseIntOr(rec.headers().lastHeader("x-manual-retry"), 0) + 1;
        pr.headers().remove("x-manual-retry");
        pr.headers().add("x-manual-retry", Integer.toString(retry).getBytes());
        return pr;
    }

    private int parseIntOr(org.apache.kafka.common.header.Header h, int def) {
        if (h == null) return def;
        try { return Integer.parseInt(new String(h.value())); } catch (Exception e) { return def; }
    }
}

