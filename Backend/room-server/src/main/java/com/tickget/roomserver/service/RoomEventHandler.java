package com.tickget.roomserver.service;

import com.tickget.roomserver.domain.entity.Room;
import com.tickget.roomserver.domain.enums.RoomStatus;
import com.tickget.roomserver.domain.repository.RoomCacheRepository;
import com.tickget.roomserver.domain.repository.RoomRepository;
import com.tickget.roomserver.dto.cache.RoomInfoUpdate;
import com.tickget.roomserver.event.HostChangedEvent;
import com.tickget.roomserver.event.MatchEndedEvent;
import com.tickget.roomserver.event.MatchSettingChangedEvent;
import com.tickget.roomserver.event.MatchStartedEvent;
import com.tickget.roomserver.event.RoomSettingUpdatedEvent;
import com.tickget.roomserver.event.SessionCloseEvent;
import com.tickget.roomserver.event.UserJoinedRoomEvent;
import com.tickget.roomserver.event.UserLeftRoomEvent;
import com.tickget.roomserver.exception.RoomNotFoundException;
import com.tickget.roomserver.kafaka.RoomEventMessage;
import com.tickget.roomserver.kafaka.RoomEventProducer;
import com.tickget.roomserver.session.WebSocketSessionManager;
import com.tickget.roomserver.util.ServerIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.socket.WebSocketSession;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoomEventHandler {

    private final WebSocketSessionManager sessionManager;
    private final RoomEventProducer roomEventProducer;
    private final SimpMessagingTemplate messagingTemplate;

    private final ServerIdProvider serverIdProvider;
    private final RoomCacheRepository roomCacheRepository;
    private final RoomRepository roomRepository;

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

    @Transactional
    public void processMatchStarted(MatchStartedEvent event) {
        log.debug("방 {} 에서 매치 {} 시작 이벤트 수신", event.getRoomId(), event.getMatchId());

        Room room = roomRepository.findById(event.getRoomId()).orElseThrow(
                () -> new RoomNotFoundException(event.getRoomId()));

        room.setStatus(RoomStatus.PLAYING);

        log.debug("방 {}의 status를 {} 로 변경", event.getRoomId(), room.getStatus());
    }

    @Transactional
    public void processMatchEnded(MatchEndedEvent event) {
        log.debug("방 {} 에서 매치 {} 종료 이벤트 수신", event.getRoomId(), event.getMatchId());
        Room room = roomRepository.findById(event.getRoomId()).orElseThrow(
                () -> new RoomNotFoundException(event.getRoomId()));

        room.setStatus(RoomStatus.WAITING);

        log.debug("방 {}의 status를 {} 로 변경", event.getRoomId(), room.getStatus());
    }

    public void processMatchSettingChanged(MatchSettingChangedEvent event) {
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
}
