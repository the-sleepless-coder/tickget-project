package com.tickget.roomserver.kafaka;

import com.tickget.roomserver.event.UserJoinedRoomEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RoomEventProducer {
    private static final String ROOM_USER_JOINED_TOPIC = "room-user-joined-events";

    private final KafkaTemplate<String, UserJoinedRoomEvent> joinedEventKafkaTemplate;

    public void publishUserJoinedEvent(UserJoinedRoomEvent event) {
        String key = event.getRoomId().toString();
        joinedEventKafkaTemplate.send(ROOM_USER_JOINED_TOPIC, key, event);
        log.debug("User joined event published - userId: {}, roomId: {}", event.getUserId(), event.getRoomId());
    }


}
