package com.tickget.roomserver.service;

import com.tickget.roomserver.domain.repository.RoomCacheRepository;
import com.tickget.roomserver.dto.cache.DisconnectInfo;
import com.tickget.roomserver.dto.cache.GlobalSessionInfo;
import com.tickget.roomserver.dto.request.ExitRoomRequest;
import com.tickget.roomserver.event.HostChangedEvent;
import com.tickget.roomserver.event.RoomPlayingEndedEvent;
import com.tickget.roomserver.event.RoomSettingUpdatedEvent;
import com.tickget.roomserver.event.SessionCloseEvent;
import com.tickget.roomserver.event.UserDequeuedEvent;
import com.tickget.roomserver.event.UserJoinedRoomEvent;
import com.tickget.roomserver.event.UserLeftRoomEvent;
import com.tickget.roomserver.kafka.RoomEventMessage;
import com.tickget.roomserver.session.SessionInfo;
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
    private final RoomService roomService;

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
            SessionInfo sessionInfo = sessionManager.getByUserId(userId);
            if (sessionInfo == null) {
                log.info("이 서버에 유저 {}의 세션이 없음 (이미 종료됨)", userId);
                return;
            }

            // 2. 현재 세션 정보 조회

            String currentSessionId = sessionInfo.getSessionId();
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

            // 5. 방 퇴장 처리를 수행
            /*
            Long roomId = sessionInfo.getRoomId();
            if (roomId != null) {
                log.info("강제 종료 전 방 퇴장 처리: userId={}, roomId={}", userId, roomId);
                try {
                    String userName = roomCacheRepository.getUserName(roomId, userId);
                    roomService.exitRoom(new ExitRoomRequest(userId, userName), roomId);
                } catch (Exception e) {
                    log.error("강제 종료 시 방 퇴장 처리 실패: userId={}, roomId={}", userId, roomId, e);
                }
            }
            */

            /* 2025-11-18, 약 14시경 승수 수정 부분 */
            // 5. 재연결 컨텍스트 확인 후 방 퇴장 처리 결정
            Long roomId = sessionInfo.getRoomId();
            if (roomId != null) {
                // ✅ Redis에서 재연결 정보 확인
                DisconnectInfo disconnectInfo = roomCacheRepository.getDisconnectInfo(userId);

                // 재연결 정보가 있고 grace period 이내라면 방 퇴장 처리 스킵
                boolean isReconnecting = disconnectInfo != null
                    && disconnectInfo.isWithinGracePeriod(5000); // 5초 이내

                if (isReconnecting) {
                    log.info("재연결 중인 유저이므로 방 퇴장 처리 스킵: userId={}, roomId={}", userId, roomId);
                    // 재연결 정보 삭제 (이미 처리됨)
                    roomCacheRepository.deleteDisconnectInfo(userId);
                } else {
                    // 일반적인 중복 로그인이므로 방 퇴장 처리 수행
                    log.info("중복 로그인 감지, 방 퇴장 처리: userId={}, roomId={}", userId, roomId);
                    try {
                        String userName = roomCacheRepository.getUserName(roomId, userId);
                        roomService.exitRoom(new ExitRoomRequest(userId, userName), roomId);
                    } catch (Exception e) {
                        log.error("강제 종료 시 방 퇴장 처리 실패: userId={}, roomId={}", userId, roomId, e);
                    }
                }
            }

            // 6. 클라이언트에게 강제 종료 알림 전송
            String userDestination = "/user/" + userId;
            RoomEventMessage disconnectMessage = RoomEventMessage.forceDisconnect( "DUPLICATE_SESSION");

            try {
                messagingTemplate.convertAndSend(userDestination, disconnectMessage);
                log.info("강제 종료 알림 전송 완료: userId={}, destination={}", userId, userDestination);

                // 클라이언트가 메시지를 받을 시간 확보 (150ms)
                Thread.sleep(150);
            } catch (Exception e) {
                log.warn("강제 종료 알림 전송 실패: userId={}, error={}", userId, e.getMessage());
            }

            // 7. 세션 정리 (로컬)
            sessionManager.remove(sessionInfo.getSessionId());
            log.info("로컬 세션 제거 완료: userId={}, sessionId={}", userId, targetSessionId);

            // 8. Redis 전역에서 원자적으로 세션 제거 
            boolean removed = roomCacheRepository.removeGlobalSession(userId, targetSessionId);

            if (removed) {
                log.info("Redis 전역 세션 제거 완료: userId={}, sessionId={}", userId, targetSessionId);
            } else {
                log.warn("Redis 전역 세션 제거 실패 (이미 다른 세션으로 교체됨): userId={}", userId);
            }

            // 9. WebSocketSession 종료 (마지막에)
            // disconnect 이벤트가 발생하지만 이미 세션 정리가 완료된 상태
            // disconnect 핸들러에서 userId 조회 시 null → 조기 return
            WebSocketSession session = sessionInfo.getSession();
            if (session != null && session.isOpen()) {
                session.close();
                log.info("세션 강제 종료 완료: userId={}", userId);
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
            if (sessionManager.getByUserId(userId) == null) {
                log.info("이 서버에 유저 {}의 세션이 없음 (다른 서버에 연결됨)", userId);
                return;
            }

            // 2. 유저가 속한 방 확인
            SessionInfo sessionInfo = sessionManager.getByUserId(userId);
            String sessionId = sessionInfo.getSessionId();
            if (sessionId == null) {
                log.warn("유저 {}의 세션 ID를 찾을 수 없음", userId);
                return;
            }

            Long roomId = sessionInfo.getRoomId();
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

    public void notifyMatchEnded(RoomPlayingEndedEvent event) {
        try {
            String destination = "/topic/rooms/" + event.getRoomId();
            Long matchId = roomCacheRepository.getMatchIdByRoomId(event.getRoomId());

            RoomEventMessage message = RoomEventMessage.matchEnded(
                    event.getRoomId(),
                    matchId
            );
            messagingTemplate.convertAndSend(destination, message);
            log.info("방 종료 매치 종료 알림 전송 완료: 방={} , 매치={}", event.getRoomId(), matchId);

        } catch (Exception e) {
            log.info("방 설정 업데이트 이벤트 처리 중 오류: 방={}, error={}",
                    event.getRoomId(), e.getMessage(), e);
        }
    }
}
