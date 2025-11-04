package com.tickget.roomserver.kafaka;

import com.tickget.roomserver.domain.repository.RoomCacheRepository;
import com.tickget.roomserver.dto.cache.RoomInfoUpdate;
import com.tickget.roomserver.event.HostChangedEvent;
import com.tickget.roomserver.event.MatchEndedEvent;
import com.tickget.roomserver.event.MatchSettingChangedEvent;
import com.tickget.roomserver.event.MatchStartedEvent;
import com.tickget.roomserver.event.RoomSettingUpdatedEvent;
import com.tickget.roomserver.event.SessionCloseEvent;
import com.tickget.roomserver.event.UserJoinedRoomEvent;
import com.tickget.roomserver.event.UserLeftRoomEvent;
import com.tickget.roomserver.service.RoomService;
import com.tickget.roomserver.session.WebSocketSessionManager;
import com.tickget.roomserver.util.ServerIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

@Slf4j
@Component
@RequiredArgsConstructor
public class RoomEventConsumer {

    private static final String ROOM_USER_JOINED_TOPIC = "room-user-joined-events";
    private static final String ROOM_USER_LEFT_TOPIC = "room-user-left-events";
    private static final String ROOM_HOST_CHANGED_TOPIC = "room-host-changed-events";
    private static final String MATCH_SETTING_CHANGED_TOPIC = "match-setting-changed-events";
    private static final String ROOM_SETTING_UPDATED_TOPIC = "room-setting-updated-events";
    private static final String ROOM_MATCH_STARTED_TOPIC = "room-match-started-events";
    private static final String ROOM_MATCH_ENDED_TOPIC = "room-match-ended-events";

    private final RoomEventProducer roomEventProducer;
    private final SimpMessagingTemplate messagingTemplate;
    private final WebSocketSessionManager sessionManager;
    private final RoomService roomService;
    private final ServerIdProvider serverIdProvider;
    private final RoomCacheRepository roomCacheRepository;

    //사용자 입장 이벤트 수신 및 브로드캐스트
    //구독한 모든 서버가 반영해야하기에 컨슈머 그룹 지정 X
    @KafkaListener(topics = ROOM_USER_JOINED_TOPIC)
    public void handleUserJoinedEvent(UserJoinedRoomEvent event) {
        roomService.handleUserJoinedEvent(event);
    }

    // ===== 사용자 퇴장: 모든 서버가 수신 =====
    @KafkaListener(topics = ROOM_USER_LEFT_TOPIC)
    public void handleUserLeftEvent(UserLeftRoomEvent event) {
        roomService.handleUserLeftEvent(event);

    }

    // ===== 호스트 변경: 모든 서버가 수신 =====
    @KafkaListener(topics = ROOM_HOST_CHANGED_TOPIC)
    public void handleHostChangedEvent(HostChangedEvent event) {
        roomService.handleHostChangedEvent(event);

    }

    @KafkaListener(topics = ROOM_MATCH_STARTED_TOPIC, groupId = "room-status-updater")
    public void handleMatchStartedEvent(MatchStartedEvent event) {

        roomService.handleMatchStartedEvent(event);
    }

    @KafkaListener(topics = ROOM_MATCH_ENDED_TOPIC, groupId = "room-status-updater")
    public void handleMatchEndedEvent(MatchEndedEvent event) {

        roomService.handleMatchEndedEvent(event);
    }

    // ===== 매치 설정 변경: 하나의 서버만 수신 (groupId = "room-setting-updater") =====
    @KafkaListener(topics = MATCH_SETTING_CHANGED_TOPIC, groupId = "room-setting-updater")
    public void handleMatchSettingChangedEvent(MatchSettingChangedEvent event) {
        roomService.handleMatchSettingChangedEvent(event);

    }

    // ===== 방 설정 업데이트: 모든 서버가 수신 (그룹 없음) =====
    @KafkaListener(topics = ROOM_SETTING_UPDATED_TOPIC)
    public void handleRoomSettingUpdatedEvent(RoomSettingUpdatedEvent event) {
        roomService.handleRoomSettingUpdatedEvent(event);

    }

    // ===== 세션 강제 종료: 대상 서버만 수신 =====
    @KafkaListener(topics = "session-close-events")
    public void handleSessionCloseEvent(SessionCloseEvent event) {
        roomService.handleSessionCloseEvent(event);

    }
}
