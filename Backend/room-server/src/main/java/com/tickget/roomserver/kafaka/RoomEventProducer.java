package com.tickget.roomserver.kafaka;

import com.tickget.roomserver.event.HostChangedEvent;
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
    private static final String ROOM_HOST_CHANGED_TOPIC = "room-host-changed-events";  // ✅ 추가

    private final KafkaTemplate<String, UserJoinedRoomEvent> joinedEventKafkaTemplate;
    private final KafkaTemplate<String, UserLeftRoomEvent> leftEventKafkaTemplate;
    private final KafkaTemplate<String, HostChangedEvent> hostChangedEventKafkaTemplate;

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

    public void publishHostChangedEvent(HostChangedEvent event) {
        String key = event.getRoomId().toString();
        hostChangedEventKafkaTemplate.send(ROOM_HOST_CHANGED_TOPIC, key, event);
        log.debug("Host changed event published - newHostId: {}, previousHostId: {}, roomId: {}",
                event.getNewHostId(), event.getPreviousHostId(), event.getRoomId());
    }


}
