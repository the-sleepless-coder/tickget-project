package com.tickget.roomserver.service;

import com.tickget.roomserver.event.HostChangedEvent;
import com.tickget.roomserver.event.RoomSettingUpdatedEvent;
import com.tickget.roomserver.event.SessionCloseEvent;
import com.tickget.roomserver.event.UserJoinedRoomEvent;
import com.tickget.roomserver.event.UserLeftRoomEvent;
import com.tickget.roomserver.kafaka.RoomEventMessage;
import com.tickget.roomserver.session.WebSocketSessionManager;
import com.tickget.roomserver.util.ServerIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoomEventHandler {

    private final WebSocketSessionManager sessionManager;
    private final SimpMessagingTemplate messagingTemplate;
    private final RoomNotificationScheduler roomNotificationScheduler;

    private final ServerIdProvider serverIdProvider;

    public void processUserJoined(UserJoinedRoomEvent event) {
        log.debug("사용자 입장 이벤트 수신: userId={}, roomId={}", event.getUserId(), event.getRoomId());

        try {
            String destination = "/topic/rooms/" + event.getRoomId();

            RoomEventMessage message = RoomEventMessage.userJoined(
                    event.getRoomId(),
                    event.getUserId(),
                    event.getTotalUsersInRoom()
            );

            messagingTemplate.convertAndSend(destination, message);
            log.debug("사용자 입장 이벤트 브로드캐스트: 방={}, 현재인원={}", event.getRoomId(), event.getTotalUsersInRoom());

        } catch (Exception e) {
            log.error("사용자 입장 이벤트 처리 중 오류: userId={}, roomId={}, error={}",
                    event.getUserId(), event.getRoomId(), e.getMessage(), e);
        }
    }

    public void processUserLeft(UserLeftRoomEvent event) {
        log.debug("사용자 퇴장 이벤트 수신: userId={}, roomId={}", event.getUserId(), event.getRoomId());

        try {
            String destination = "/topic/rooms/" + event.getRoomId();

            RoomEventMessage message = RoomEventMessage.userLeft(
                    event.getRoomId(),
                    event.getUserId(),
                    event.getTotalUsersInRoom()
            );

            messagingTemplate.convertAndSend(destination, message);
            log.debug("사용자 퇴장 이벤트 브로드캐스트: 방={}, 남은인원={}", event.getRoomId(), event.getTotalUsersInRoom());

        } catch (Exception e) {
            log.error("사용자 퇴장 이벤트 처리 중 오류: userId={}, roomId={}, error={}",
                    event.getUserId(), event.getRoomId(), e.getMessage(), e);
        }
    }

    public void processHostChanged(HostChangedEvent event) {
        log.debug("호스트 변경 이벤트 수신: 방={}, 이전호스트={}, 새호스트={}",
                event.getRoomId(), event.getPreviousHostId(), event.getNewHostId());

        try {
            String destination = "/topic/rooms/" + event.getRoomId();

            RoomEventMessage message = RoomEventMessage.hostChanged(
                    event.getRoomId(),
                    event.getPreviousHostId(),
                    event.getNewHostId(),
                    event.getTimestamp()
            );

            messagingTemplate.convertAndSend(destination, message);
            log.debug("호스트 변경 이벤트 브로드캐스트: 방={}, 새호스트={}",
                    event.getRoomId(), event.getNewHostId());

        } catch (Exception e) {
            log.error("호스트 변경 이벤트 처리 중 오류: 방={}, error={}",
                    event.getRoomId(), e.getMessage(), e);
        }
    }

    public void processRoomSettingUpdated(RoomSettingUpdatedEvent event) {
        log.debug("방 설정 업데이트 이벤트 수신: 방={}, 난이도={}, 최대인원={}",
                event.getRoomId(), event.getDifficulty(), event.getMaxUserCount());

        try {
            String destination = "/topic/rooms/" + event.getRoomId();
            RoomEventMessage message = RoomEventMessage.roomSettingUpdated(
                    event.getRoomId(),
                    event.getMatchName(),
                    event.getDifficulty(),
                    event.getMaxUserCount(),
                    event.getStartTime()
            );
            messagingTemplate.convertAndSend(destination, message);
            log.debug("방 설정 업데이트 이벤트 브로드캐스트: 방={}", event.getRoomId());

        } catch (Exception e) {
            log.error("방 설정 업데이트 이벤트 처리 중 오류: 방={}, error={}",
                    event.getRoomId(), e.getMessage(), e);
        }
    }


    public void processSessionClose(SessionCloseEvent event) {
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

    public void startNotifyingScheduling(Long roomId) {
        log.info("방 {} 대기열 상태 알림 시작", roomId);
        roomNotificationScheduler.startScheduling(roomId);
    }

    public void endNotifyingScheduling(Long roomId) {
        log.info("방 {} 대기열 상태 알림 종료", roomId);
        roomNotificationScheduler.stopScheduling(roomId);
    }
}
