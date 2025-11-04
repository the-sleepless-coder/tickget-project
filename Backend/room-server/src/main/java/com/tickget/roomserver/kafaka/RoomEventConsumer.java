package com.tickget.roomserver.kafaka;

import com.tickget.roomserver.domain.enums.EventType;
import com.tickget.roomserver.domain.repository.RoomCacheRepository;
import com.tickget.roomserver.dto.cache.RoomInfoUpdate;
import com.tickget.roomserver.event.HostChangedEvent;
import com.tickget.roomserver.event.MatchSettingChangedEvent;
import com.tickget.roomserver.event.RoomSettingUpdatedEvent;
import com.tickget.roomserver.event.SessionCloseEvent;
import com.tickget.roomserver.event.UserJoinedRoomEvent;
import com.tickget.roomserver.event.UserLeftRoomEvent;
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

    private final RoomEventProducer roomEventProducer;
    private final SimpMessagingTemplate messagingTemplate;
    private final WebSocketSessionManager sessionManager;
    private final ServerIdProvider serverIdProvider;
    private final RoomCacheRepository roomCacheRepository;

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


    @KafkaListener(topics = ROOM_HOST_CHANGED_TOPIC)
    public void handleHostChangedEvent(HostChangedEvent event) {
        log.debug("Received host changed event - newHostId: {}, previousHostId: {}, roomId: {}",
                event.getNewHostId(), event.getPreviousHostId(), event.getRoomId());

        String destination = "/topic/rooms/" + event.getRoomId();

        RoomEventMessage message = RoomEventMessage.builder()
                .eventType(EventType.HOST_CHANGED)
                .userId(Long.parseLong(event.getNewHostId()))
                .roomId(event.getRoomId())
                .message("방장이 변경되었습니다.")
                .timestamp(event.getTimestamp())
                .build();

        messagingTemplate.convertAndSend(destination, message);
        log.info("Broadcasted host changed event to topic: {}", destination);
    }



    @KafkaListener(topics = "session-close-events")
    public void handleSessionCloseEvent(SessionCloseEvent event) {
        log.debug("Received session close event - userId: {}, targetServerId: {}",
                event.getUserId(), event.getTargetServerId());

        String myServerId = serverIdProvider.getServerId();

        // 이 서버가 타겟인지 확인
        if (!myServerId.equals(event.getTargetServerId())) {
            return; // 다른 서버로 보낸 이벤트
        }

        Long userId = event.getUserId();

        // 해당 유저의 세션이 있으면 종료
        if (sessionManager.hasSession(userId)) {
            log.info("다른 서버 요청으로 세션 종료: userId={}, sessionId={}",
                    userId, event.getSessionId());

            WebSocketSession session = sessionManager.getSessionByUserId(userId);

            if (session != null) {
                sessionManager.closeSession(session);
                sessionManager.removeSessionData(session.getId());
                log.info("세션 강제 종료 완료: userId={}", userId);
            }
        } else {
            log.debug("종료 요청받았으나 해당 세션 없음: userId={}", userId);
        }
    }


    @KafkaListener(topics =MATCH_SETTING_CHANGED_TOPIC, groupId = "room-setting-updater")
    public void handleMatchSettingChangedEvent(MatchSettingChangedEvent event) {
        log.debug("Received match setting changed event - roomId: {}, difficulty: {}, maxUserCount: {}, startTime: {}",
                event.getRoomId(), event.getDifficulty(), event.getMaxUserCount(), event.getStartTime());

        try{
            RoomInfoUpdate infoUpdate = RoomInfoUpdate.from(event);
            roomCacheRepository.updateRoomInfo(infoUpdate);
            
            //TODO: 이 변경사항을 소켓통신을 통해 모두에게 알리는 로직
            roomEventProducer.publishRoomSettingUpdatedEvent(event);

        } catch (Exception e) {
            log.error("매치 설정 변경 이벤트 처리 중 오류 발생 - roomId: {}, error: {}",
                    event.getRoomId(), e.getMessage(), e);
        }
    }

    @KafkaListener(topics =ROOM_SETTING_UPDATED_TOPIC)
    public void handleRoomSettingUpdatedEvent(RoomSettingUpdatedEvent event) {
        String destination = "/topic/rooms/" + event.getRoomId();
        RoomSettingUpdatedMessage message = RoomSettingUpdatedMessage.from(event);

        messagingTemplate.convertAndSend(destination, message);

    }
}
