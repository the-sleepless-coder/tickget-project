package com.tickget.roomserver.kafaka;

import com.tickget.roomserver.event.HostChangedEvent;
import com.tickget.roomserver.event.RoomPlayingEndedEvent;
import com.tickget.roomserver.event.RoomPlayingStartedEvent;
import com.tickget.roomserver.event.RoomSettingUpdatedEvent;
import com.tickget.roomserver.event.SessionCloseEvent;
import com.tickget.roomserver.event.UserDequeuedEvent;
import com.tickget.roomserver.event.UserJoinedRoomEvent;
import com.tickget.roomserver.event.UserLeftRoomEvent;
import com.tickget.roomserver.service.RoomEventHandler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RoomEventConsumer {

    private static final String ROOM_USER_JOINED_TOPIC = "room-user-joined-events";
    private static final String ROOM_USER_LEFT_TOPIC = "room-user-left-events";
    private static final String ROOM_HOST_CHANGED_TOPIC = "room-host-changed-events";
    private static final String ROOM_SETTING_UPDATED_TOPIC = "room-setting-updated-events";
    private static final String ROOM_PLAYING_STARTED_TOPIC = "room-playing-started-events";
    private static final String ROOM_PLAYING_ENDED_TOPIC = "room-playing-ended-events";
    private static final String USER_DEQUEUED_TOPIC = "user-dequeued-publish";

    private final RoomEventHandler roomEventHandler;

    //사용자 입장 이벤트 수신 및 브로드캐스트
    //구독한 모든 서버가 반영해야하기에 컨슈머 그룹 지정 X
    @KafkaListener(topics = ROOM_USER_JOINED_TOPIC)
    public void handleUserJoinedEvent(UserJoinedRoomEvent event) {
        roomEventHandler.processUserJoined(event);
    }

    // ===== 사용자 퇴장: 모든 서버가 수신 =====
    @KafkaListener(topics = ROOM_USER_LEFT_TOPIC)
    public void handleUserLeftEvent(UserLeftRoomEvent event) {
        roomEventHandler.processUserLeft(event);

    }

    // ===== 호스트 변경: 모든 서버가 수신 =====
    @KafkaListener(topics = ROOM_HOST_CHANGED_TOPIC)
    public void handleHostChangedEvent(HostChangedEvent event) {
        roomEventHandler.processHostChanged(event);

    }


    // ===== 방 설정 업데이트: 모든 서버가 수신 (그룹 없음) =====
    @KafkaListener(topics = ROOM_SETTING_UPDATED_TOPIC)
    public void handleRoomSettingUpdatedEvent(RoomSettingUpdatedEvent event) {
        roomEventHandler.processRoomSettingUpdated(event);
    }

    // ===== 세션 강제 종료: 대상 서버만 수신 =====
    @KafkaListener(topics = "session-close-events")
    public void handleSessionCloseEvent(SessionCloseEvent event) {
        roomEventHandler.processSessionClose(event);
    }

    @KafkaListener(topics = ROOM_PLAYING_STARTED_TOPIC)
    public void handleRoomPlayingStartedEvent(RoomPlayingStartedEvent event) {
        roomEventHandler.startNotifyingScheduling(event.getRoomId());
    }

    @KafkaListener(topics = ROOM_PLAYING_ENDED_TOPIC)
    public void handleRoomPlayingEndedEvent(RoomPlayingEndedEvent event) {
        roomEventHandler.endNotifyingScheduling(event.getRoomId());
    }

    @KafkaListener(topics = USER_DEQUEUED_TOPIC)
    public void handleUserDequeuedEvent(UserDequeuedEvent event) {
        roomEventHandler.processUserDequeued(event);
    }
}
