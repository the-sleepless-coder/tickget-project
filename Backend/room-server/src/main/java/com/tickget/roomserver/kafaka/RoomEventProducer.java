package com.tickget.roomserver.kafaka;

import com.tickget.roomserver.dto.request.MatchSettingUpdateRequest;
import com.tickget.roomserver.event.HostChangedEvent;
import com.tickget.roomserver.event.RoomSettingUpdatedEvent;
import com.tickget.roomserver.event.SessionCloseEvent;
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
    private static final String ROOM_HOST_CHANGED_TOPIC = "room-host-changed-events";
    private static final String SESSION_CLOSE_TOPIC = "session-close-events";
    private static final String ROOM_SETTING_UPDATED_TOPIC = "room-setting-updated-events";

    private final KafkaTemplate<String, UserJoinedRoomEvent> joinedEventKafkaTemplate;
    private final KafkaTemplate<String, UserLeftRoomEvent> leftEventKafkaTemplate;
    private final KafkaTemplate<String, HostChangedEvent> hostChangedEventKafkaTemplate;
    private final KafkaTemplate<String, SessionCloseEvent> sessionCloseEventKafkaTemplate;
    private final KafkaTemplate<String, RoomSettingUpdatedEvent> roomSettingUpdatedEventKafkaTemplate;

    public void publishUserJoinedEvent(UserJoinedRoomEvent event) {
        String key = event.getRoomId().toString();
        joinedEventKafkaTemplate.send(ROOM_USER_JOINED_TOPIC, key, event);
        log.debug("사용자 입장 이벤트 발행: userId={}, roomId={}, 현재인원={}",
                event.getUserId(), event.getRoomId(), event.getTotalUsersInRoom());
    }

    public void publishUserLeftEvent(UserLeftRoomEvent event) {
        String key = event.getRoomId().toString();
        leftEventKafkaTemplate.send(ROOM_USER_LEFT_TOPIC, key, event);
        log.debug("사용자 퇴장 이벤트 발행: userId={}, roomId={}, 남은인원={}",
                event.getUserId(), event.getRoomId(), event.getTotalUsersInRoom());
    }

    public void publishHostChangedEvent(HostChangedEvent event) {
        String key = event.getRoomId().toString();
        hostChangedEventKafkaTemplate.send(ROOM_HOST_CHANGED_TOPIC, key, event);
        log.debug("호스트 변경 이벤트 발행: 방={}, 이전호스트={}, 새호스트={}",
                event.getRoomId(), event.getPreviousHostId(), event.getNewHostId());
    }

    public void publishSessionCloseEvent(SessionCloseEvent event) {
        String key = event.getUserId().toString();
        sessionCloseEventKafkaTemplate.send(SESSION_CLOSE_TOPIC, key, event);
        log.debug("세션 강제 종료 이벤트 발행: userId={}, sessionId={}, 대상서버={}",
                event.getUserId(), event.getSessionId(), event.getTargetServerId());
    }

    public void publishRoomSettingUpdatedEvent(MatchSettingUpdateRequest matchSettingUpdateRequest) {
        String key = matchSettingUpdateRequest.getRoomId().toString();
        RoomSettingUpdatedEvent event = RoomSettingUpdatedEvent.from(matchSettingUpdateRequest);

        roomSettingUpdatedEventKafkaTemplate.send(ROOM_SETTING_UPDATED_TOPIC, key, event);
        log.debug("방 설정 업데이트 이벤트 발행: 방={}, 난이도={}, 최대인원={}",
                event.getRoomId(), event.getDifficulty(), event.getMaxUserCount());
    }
}
