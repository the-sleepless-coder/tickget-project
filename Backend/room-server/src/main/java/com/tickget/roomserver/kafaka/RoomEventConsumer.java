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
        log.debug("사용자 입장 이벤트 수신: userId={}, roomId={}", event.getUserId(), event.getRoomId());

        try {
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
            log.debug("사용자 입장 이벤트 브로드캐스트: 방={}, 현재인원={}", event.getRoomId(), event.getTotalUsersInRoom());

        } catch (Exception e) {
            log.error("사용자 입장 이벤트 처리 중 오류: userId={}, roomId={}, error={}",
                    event.getUserId(), event.getRoomId(), e.getMessage(), e);
        }
    }

    // ===== 사용자 퇴장: 모든 서버가 수신 =====
    @KafkaListener(topics = ROOM_USER_LEFT_TOPIC)
    public void handleUserLeftEvent(UserLeftRoomEvent event) {
        log.debug("사용자 퇴장 이벤트 수신: userId={}, roomId={}", event.getUserId(), event.getRoomId());

        try {
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
            log.debug("사용자 퇴장 이벤트 브로드캐스트: 방={}, 남은인원={}", event.getRoomId(), event.getTotalUsersInRoom());

        } catch (Exception e) {
            log.error("사용자 퇴장 이벤트 처리 중 오류: userId={}, roomId={}, error={}",
                    event.getUserId(), event.getRoomId(), e.getMessage(), e);
        }
    }

    // ===== 호스트 변경: 모든 서버가 수신 =====
    @KafkaListener(topics = ROOM_HOST_CHANGED_TOPIC)
    public void handleHostChangedEvent(HostChangedEvent event) {
        log.debug("호스트 변경 이벤트 수신: 방={}, 이전호스트={}, 새호스트={}",
                event.getRoomId(), event.getPreviousHostId(), event.getNewHostId());

        try {
            String destination = "/topic/rooms/" + event.getRoomId();

            RoomEventMessage message = RoomEventMessage.builder()
                    .eventType(EventType.HOST_CHANGED)
                    .userId(Long.parseLong(event.getNewHostId()))
                    .roomId(event.getRoomId())
                    .message("방장이 변경되었습니다.")
                    .timestamp(event.getTimestamp())
                    .build();

            messagingTemplate.convertAndSend(destination, message);
            log.debug("호스트 변경 이벤트 브로드캐스트: 방={}, 새호스트={}",
                    event.getRoomId(), event.getNewHostId());

        } catch (Exception e) {
            log.error("호스트 변경 이벤트 처리 중 오류: 방={}, error={}",
                    event.getRoomId(), e.getMessage(), e);
        }
    }

    // ===== 매치 설정 변경: 하나의 서버만 수신 (groupId = "room-setting-updater") =====
    @KafkaListener(topics = MATCH_SETTING_CHANGED_TOPIC, groupId = "room-setting-updater")
    public void handleMatchSettingChangedEvent(MatchSettingChangedEvent event) {
        log.debug("매치 설정 변경 이벤트 수신 (단일 컨슈머): 방={}, 난이도={}, 최대인원={}",
                event.getRoomId(), event.getDifficulty(), event.getMaxUserCount());

        try {
            // 1. Redis 업데이트 (하나의 서버만 실행)
            RoomInfoUpdate infoUpdate = RoomInfoUpdate.from(event);
            roomCacheRepository.updateRoomInfo(infoUpdate);
            log.debug("Redis 방 정보 업데이트 완료: 방={}",  event.getRoomId());

            // 2. 다시 발행 (모든 서버가 구독하도록)
            roomEventProducer.publishRoomSettingUpdatedEvent(event);
            log.debug("방 설정 업데이트 이벤트 재발행: 방={}", event.getRoomId());

        } catch (Exception e) {
            log.error("매치 설정 변경 이벤트 처리 중 오류: 방={}, error={}",
                    event.getRoomId(), e.getMessage(), e);
        }
    }

    // ===== 방 설정 업데이트: 모든 서버가 수신 (그룹 없음) =====
    @KafkaListener(topics = ROOM_SETTING_UPDATED_TOPIC)
    public void handleRoomSettingUpdatedEvent(RoomSettingUpdatedEvent event) {
        log.debug("방 설정 업데이트 이벤트 수신: 방={}, 난이도={}, 최대인원={}",
                event.getRoomId(), event.getDifficulty(), event.getMaxUserCount());

        try {
            String destination = "/topic/rooms/" + event.getRoomId();
            RoomSettingUpdatedMessage message = RoomSettingUpdatedMessage.from(event);

            messagingTemplate.convertAndSend(destination, message);
            log.debug("방 설정 업데이트 이벤트 브로드캐스트: 방={}", event.getRoomId());

        } catch (Exception e) {
            log.error("방 설정 업데이트 이벤트 처리 중 오류: 방={}, error={}",
                    event.getRoomId(), e.getMessage(), e);
        }
    }

    // ===== 세션 강제 종료: 대상 서버만 수신 =====
    @KafkaListener(topics = "session-close-events")
    public void handleSessionCloseEvent(SessionCloseEvent event) {
        log.debug("세션 강제 종료 이벤트 수신: userId={}, 대상서버={}", event.getUserId(), event.getTargetServerId());

        String myServerId = serverIdProvider.getServerId();

        // 이 서버가 타겟인지 확인
        if (!myServerId.equals(event.getTargetServerId())) {
            log.debug("다른 서버의 세션 종료 이벤트 무시: userId={}, 대상서버={}", event.getUserId(), event.getTargetServerId());
            return;
        }

        Long userId = event.getUserId();

        try {
            // 해당 유저의 세션이 있으면 종료
            if (sessionManager.hasSession(userId)) {
                log.info("세션 강제 종료 처리: userId={}, sessionId={}", userId, event.getSessionId());

                WebSocketSession session = sessionManager.getSessionByUserId(userId);

                if (session != null) {
                    sessionManager.closeSession(session);
                    sessionManager.removeSessionData(session.getId());
                    log.info("세션 강제 종료 완료: userId={}", userId);
                } else {
                    log.warn("세션 객체를 찾을 수 없음: userId={}", userId);
                }
            } else {
                log.debug("해당 유저의 세션이 없음 (이미 종료됨): userId={}", userId);
            }
        } catch (Exception e) {
            log.error("세션 강제 종료 중 오류: userId={}, error={}",
                    userId, e.getMessage(), e);
        }
    }
}
