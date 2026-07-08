package com.tickget.roomserver.kafka;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tickget.roomserver.exception.RoomNotFoundException;
import com.tickget.roomserver.service.RoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * ticketing-server 가 경기 취소 시 발행하는 match.room.cancelled 이벤트 컨슈머.
 *
 * 기존에는 ticketing → room 의 PATCH /rooms/{roomId}/cancel HTTP(best-effort) 였으나,
 * ticketing DB 는 CANCELLED 로 커밋됐는데 통지만 유실되는 문제가 있어 outbox 발행 보장으로 전환했다.
 * 그 발행을 여기서 받아 기존 취소 로직(RoomService.cancelRoomMatch)을 그대로 수행한다.
 *
 * payload 예: {"matchId":123,"roomId":456}
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MatchRoomCancelConsumer {

    private static final String MATCH_ROOM_CANCELLED_TOPIC = "match.room.cancelled";

    private final RoomService roomService;
    private final ObjectMapper objectMapper;

    @KafkaListener(
            topics = MATCH_ROOM_CANCELLED_TOPIC,
            containerFactory = "matchRoomCancelKafkaListenerContainerFactory")
    public void handleMatchRoomCancelled(String message) {
        Long roomId = extractRoomId(message);
        if (roomId == null) {
            log.error("match.room.cancelled roomId 파싱 실패 - 스킵: message={}", message);
            return; // 파싱 불가 메시지로 컨슈머가 막히지 않도록 스킵
        }

        try {
            roomService.cancelRoomMatch(roomId);
            log.info("경기 취소 이벤트 처리 완료: roomId={}", roomId);
        } catch (RoomNotFoundException e) {
            // 이미 정리된 방이면 재처리 불필요 - 재시도 루프 방지
            log.warn("취소 대상 방 없음 - 스킵: roomId={}", roomId);
        }
    }

    // payload 가 순수 JSON 객체({"roomId":..})든 이중 인코딩된 문자열("{\"roomId\":..}")이든 모두 처리
    private Long extractRoomId(String message) {
        try {
            JsonNode node = objectMapper.readTree(message);
            if (node.isTextual()) { // 이중 인코딩된 경우 한 번 더 언랩
                node = objectMapper.readTree(node.asText());
            }
            JsonNode roomIdNode = node.get("roomId");
            return roomIdNode != null && roomIdNode.canConvertToLong() ? roomIdNode.asLong() : null;
        } catch (Exception e) {
            log.error("match.room.cancelled payload 파싱 오류: message={}", message, e);
            return null;
        }
    }
}
