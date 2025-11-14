package com.tickget.roomserver.service;

import com.tickget.roomserver.domain.repository.RoomCacheRepository;
import com.tickget.roomserver.dto.cache.GlobalSessionInfo;
import com.tickget.roomserver.event.HostChangedEvent;
import com.tickget.roomserver.event.RoomSettingUpdatedEvent;
import com.tickget.roomserver.event.SessionCloseEvent;
import com.tickget.roomserver.event.UserDequeuedEvent;
import com.tickget.roomserver.event.UserJoinedRoomEvent;
import com.tickget.roomserver.event.UserLeftRoomEvent;
import com.tickget.roomserver.kafka.RoomEventMessage;
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
    private final RoomCacheRepository roomCacheRepository;

    private final ServerIdProvider serverIdProvider;

    public void processUserJoined(UserJoinedRoomEvent event) {
        log.info("사용자 입장 이벤트 수신: userId={}, roomId={}", event.getUserId(), event.getRoomId());

        try {
            String destination = "/topic/rooms/" + event.getRoomId();

            RoomEventMessage message = RoomEventMessage.userJoined(
                    event.getRoomId(),
                    event.getUserId(),
                    event.getUserName(),
                    event.getTotalUsersInRoom()
            );

            messagingTemplate.convertAndSend(destination, message);
            log.info("사용자 입장 이벤트 브로드캐스트: 방={}, 현재인원={}", event.getRoomId(), event.getTotalUsersInRoom());

        } catch (Exception e) {
            log.info("사용자 입장 이벤트 처리 중 오류: userId={}, roomId={}, error={}",
                    event.getUserId(), event.getRoomId(), e.getMessage(), e);
        }
    }

    public void processUserLeft(UserLeftRoomEvent event) {
        log.info("사용자 퇴장 이벤트 수신: userId={}, roomId={}", event.getUserId(), event.getRoomId());

        try {
            String destination = "/topic/rooms/" + event.getRoomId();

            RoomEventMessage message = RoomEventMessage.userLeft(
                    event.getRoomId(),
                    event.getUserId(),
                    event.getTotalUsersInRoom()
            );

            messagingTemplate.convertAndSend(destination, message);
            log.info("사용자 퇴장 이벤트 브로드캐스트: 방={}, 남은인원={}", event.getRoomId(), event.getTotalUsersInRoom());

        } catch (Exception e) {
            log.info("사용자 퇴장 이벤트 처리 중 오류: userId={}, roomId={}, error={}",
                    event.getUserId(), event.getRoomId(), e.getMessage(), e);
        }
    }

    public void processHostChanged(HostChangedEvent event) {
        log.info("호스트 변경 이벤트 수신: 방={}, 이전호스트={}, 새호스트={}",
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
            log.info("호스트 변경 이벤트 브로드캐스트: 방={}, 새호스트={}",
                    event.getRoomId(), event.getNewHostId());

        } catch (Exception e) {
            log.info("호스트 변경 이벤트 처리 중 오류: 방={}, error={}",
                    event.getRoomId(), e.getMessage(), e);
        }
    }

    public void processRoomSettingUpdated(RoomSettingUpdatedEvent event) {
        log.info("방 설정 업데이트 이벤트 수신: 방={}, 난이도={}, 최대인원={}",
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
            log.info("방 설정 업데이트 이벤트 브로드캐스트: 방={}", event.getRoomId());

        } catch (Exception e) {
            log.info("방 설정 업데이트 이벤트 처리 중 오류: 방={}, error={}",
                    event.getRoomId(), e.getMessage(), e);
        }
    }


    public void processSessionClose(SessionCloseEvent event) {
        log.info("세션 강제 종료 이벤트 수신: userId={}, sessionId={}, targetServerId={}, version={}",
                event.getUserId(), event.getSessionId(), event.getTargetServerId(), event.getSessionVersion());

        String myServerId = serverIdProvider.getServerId();

        // 이 서버가 타겟인지 확인
        if (!myServerId.equals(event.getTargetServerId())) {
            log.info("다른 서버의 세션 종료 이벤트 무시: userId={}, targetServerId={}",
                    event.getUserId(), event.getTargetServerId());
            return;
        }

        Long userId = event.getUserId();
        String targetSessionId = event.getSessionId();
        Long eventVersion = event.getSessionVersion();

        try {
            // 1. 해당 유저의 세션이 있는지 확인
            if (!sessionManager.hasSession(userId)) {
                log.info("이 서버에 유저 {}의 세션이 없음 (이미 종료됨)", userId);
                return;
            }

            // 2. 현재 세션 정보 조회
            String currentSessionId = sessionManager.getSessionIdByUserId(userId);
            if (currentSessionId == null) {
                log.warn("유저 {}의 세션 ID를 찾을 수 없음", userId);
                return;
            }

            // 3. sessionId 불일치 확인 (새 세션이 이미 등록된 경우)
            if (!currentSessionId.equals(targetSessionId)) {
                log.warn("세션 ID 불일치로 종료 무시: userId={}, 이벤트sessionId={}, 현재sessionId={}",
                        userId, targetSessionId, currentSessionId);
                return;
            }

            // 4. Redis에서 현재 전역 세션 버전 확인
            GlobalSessionInfo currentGlobalSession = roomCacheRepository.getGlobalSession(userId);
            if (currentGlobalSession != null) {
                Long currentVersion = currentGlobalSession.getVersion();

                // 버전 비교: 이벤트 버전이 현재 버전보다 낮으면 무시
                if (eventVersion < currentVersion) {
                    log.warn("세션 버전 불일치로 종료 무시: userId={}, 이벤트version={}, 현재version={}",
                            userId, eventVersion, currentVersion);
                    return;
                }

                log.info("세션 버전 일치 확인: userId={}, version={}", userId, eventVersion);
            }

            // 5. 클라이언트에게 강제 종료 알림 전송
            String userDestination = "/user/" + userId;
            RoomEventMessage disconnectMessage = RoomEventMessage.forceDisconnect(userId, "DUPLICATE_SESSION");

            try {
                messagingTemplate.convertAndSend(userDestination, disconnectMessage);
                log.info("강제 종료 알림 전송 완료: userId={}, destination={}", userId, userDestination);

                // 클라이언트가 메시지를 받을 시간 확보 (150ms)
                Thread.sleep(150);
            } catch (Exception e) {
                log.warn("강제 종료 알림 전송 실패: userId={}, error={}", userId, e.getMessage());
            }

            // 6. 세션 강제 종료 처리
            WebSocketSession session = sessionManager.getSessionByUserId(userId);

            if (session != null) {
                log.info("세션 강제 종료 처리: userId={}, sessionId={}", userId, targetSessionId);
                sessionManager.closeSession(session);
                sessionManager.removeSessionData(session.getId());
                log.info("세션 강제 종료 완료: userId={}", userId);
            } else {
                log.warn("세션 객체를 찾을 수 없음: userId={}", userId);
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


    public void processUserDequeued(UserDequeuedEvent event) {
        log.info("유저 Dequeue 이벤트 수신: userId={}, roomId={}, matchId={}",
                event.getUserId(), event.getRoomId(), event.getMatchId());

        Long userId = event.getUserId();

        try {
            // 1. 이 서버에 해당 유저의 세션이 있는지 확인
            if (!sessionManager.hasSession(userId)) {
                log.info("이 서버에 유저 {}의 세션이 없음 (다른 서버에 연결됨)", userId);
                return;
            }

            // 2. 유저가 속한 방 확인
            String sessionId = sessionManager.getSessionIdByUserId(userId);
            if (sessionId == null) {
                log.warn("유저 {}의 세션 ID를 찾을 수 없음", userId);
                return;
            }

            Long roomId = sessionManager.getRoomBySessionId(sessionId);
            if (roomId == null) {
                log.warn("유저 {}가 어떤 방에도 속하지 않음", userId);
                return;
            }

            // 3. 이벤트의 roomId와 실제 유저가 속한 roomId 일치 확인
            if (!roomId.equals(event.getRoomId())) {
                log.warn("유저 {}의 방 불일치: 이벤트 roomId={}, 실제 roomId={}",
                        userId, event.getRoomId(), roomId);
                return;
            }

            // 4. Dequeue 성공 메시지 전송
            String destination = "/topic/rooms/" + roomId;

            RoomEventMessage message = RoomEventMessage.userDequeued(
                    roomId,
                    userId,
                    event.getMatchId(),
                    event.getTimestamp()
            );

            messagingTemplate.convertAndSend(destination, message);
            log.info("유저 {} Dequeue 알림 전송 완료: 방={}, 매치={}",
                    userId, roomId, event.getMatchId());

        } catch (Exception e) {
            log.error("유저 Dequeue 이벤트 처리 중 오류: userId={}, roomId={}, error={}",
                    userId, event.getRoomId(), e.getMessage(), e);
        }
    }
}
