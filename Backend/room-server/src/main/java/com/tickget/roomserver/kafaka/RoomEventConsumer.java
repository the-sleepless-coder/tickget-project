package com.tickget.roomserver.kafaka;

import com.tickget.roomserver.domain.enums.EventType;
import com.tickget.roomserver.event.UserJoinedRoomEvent;
import com.tickget.roomserver.event.UserLeftRoomEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RoomEventConsumer {

    private static final String ROOM_USER_JOINED_TOPIC = "room-user-joined-events";
    private static final String ROOM_USER_LEFT_TOPIC = "room-user-left-events";

    private final SimpMessagingTemplate messagingTemplate;

    //사용자 입장 이벤트 수신 및 브로드캐스트
    //구독한 모든 서버가 반영해야하기에 컨슈머 그룹 지정 X
    @KafkaListener(topics = ROOM_USER_JOINED_TOPIC)
    public void handleUserJoinedEvent(UserJoinedRoomEvent event) {
        log.debug("Received user joined event - userId: {}, roomId: {}",
                event.getUserId(), event.getRoomId());

        // 해당 방에 속한 모든 사용자에게 메시지 브로드캐스트
        String destination = "/topic/rooms/" + event.getRoomId();

        RoomEventMessage message = RoomEventMessage.builder()
                .eventType(EventType.USER_JOINED)
                .userId(event.getUserId())
                .roomId(event.getRoomId())
                .totalUsersInRoom(event.getTotalUsersInRoom())
                .message(event.getUserId() + "이 방에 입장했습니다.")
                .timestamp(System.currentTimeMillis())
                .build();

        messagingTemplate.convertAndSend(destination, message);
        log.info("Broadcasted user joined event to topic: {}", destination);
    }

    @KafkaListener(topics = ROOM_USER_LEFT_TOPIC)
    public void handleUserLeftEvent(UserLeftRoomEvent event) {
        log.debug("Received user left event - userId: {}, roomId: {}",
                event.getUserId(), event.getRoomId());

        String destination = "/topic/rooms/" + event.getRoomId();

        RoomEventMessage message = RoomEventMessage.builder()
                .eventType(EventType.USER_LEFT)
                .userId(event.getUserId())
                .roomId(event.getRoomId())
                .totalUsersInRoom(event.getTotalUsersInRoom())
                .message(event.getUserId() + "이 방에서 퇴장했습니다.")
                .timestamp(System.currentTimeMillis())
                .build();

        messagingTemplate.convertAndSend(destination, message);
        log.info("Broadcasted user left event to topic: {}", destination);
    }
}
