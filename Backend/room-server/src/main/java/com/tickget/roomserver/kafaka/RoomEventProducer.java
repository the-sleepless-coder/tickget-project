package com.tickget.roomserver.kafaka;

import com.tickget.roomserver.event.UserJoinedRoomEvent;
import com.tickget.roomserver.event.UserLeftRoomEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RoomEventProducer {
    private static final String ROOM_USER_JOINED_TOPIC = "room-user-joined-events";
    private static final String ROOM_USER_LEFT_TOPIC = "room-user-left-events";

    private final KafkaTemplate<String, UserJoinedRoomEvent> joinedEventKafkaTemplate;
    private final KafkaTemplate<String, UserLeftRoomEvent> leftEventKafkaTemplate;

    public void publishUserJoinedEvent(UserJoinedRoomEvent event) {
        String key = event.getRoomId().toString();
        joinedEventKafkaTemplate.send(ROOM_USER_JOINED_TOPIC, key, event);
        log.debug("User joined event published - userId: {}, roomId: {}", event.getUserId(), event.getRoomId());
    }

    public void publishUserLeftEvent(UserLeftRoomEvent event) {
        String key = event.getRoomId().toString();
        leftEventKafkaTemplate.send(ROOM_USER_LEFT_TOPIC, key, event);
        log.debug("User left event published - userId: {}, roomId: {}",
                event.getUserId(), event.getRoomId());
    }


}
