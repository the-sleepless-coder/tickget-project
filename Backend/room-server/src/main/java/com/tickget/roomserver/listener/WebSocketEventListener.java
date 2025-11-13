package com.tickget.roomserver.listener;

import com.tickget.roomserver.domain.repository.RoomCacheRepository;
import com.tickget.roomserver.dto.cache.GlobalSessionInfo;
import com.tickget.roomserver.dto.request.ExitRoomRequest;
import com.tickget.roomserver.event.SessionCloseEvent;
import com.tickget.roomserver.kafka.RoomEventProducer;
import com.tickget.roomserver.service.RoomService;
import com.tickget.roomserver.session.WebSocketSessionManager;
import com.tickget.roomserver.util.ServerIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/*
웹소켓 관련 이벤트를 감지 후, 그에 맞는 파라미터를 가진 메서드를 실행하여 로직 실행
*/
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final WebSocketSessionManager sessionManager;
    private final RoomService roomService;
    private final RoomCacheRepository roomCacheRepository;
    private final RoomEventProducer roomEventProducer;
    private final ServerIdProvider serverIdProvider;

    // 소켓 연결 시 (SessionConnectedEvent 발생 시)
    @EventListener
    public void handleWebSocketConnectEvent(SessionConnectedEvent event) {
        StompHeaderAccessor headers = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headers.getSessionId();

        // simpConnectMessage에서 세션 속성 가져오기 (여기가 핵심!)
        Message<?> connectMessage = (Message<?>) headers.getHeader("simpConnectMessage");
        if (connectMessage == null) {
            log.error("simpConnectMessage가 null - sessionId: {}", sessionId);
            return;
        }

        StompHeaderAccessor connectHeaders = StompHeaderAccessor.wrap(connectMessage);
        Long userId = (Long) connectHeaders.getSessionAttributes().get("userId");

        if (userId == null) {
            log.error("세션 속성에 userId가 없음 - sessionId: {}", sessionId);
            return;
        }

        String serverId = serverIdProvider.getServerId();

        // Redis에서 전역 세션 확인
        GlobalSessionInfo globalSession = roomCacheRepository.getGlobalSession(userId);

        if (globalSession != null) {
            log.warn("유저 {}의 기존 전역 세션 발견 - sessionId: {}, serverId: {}",
                    userId, globalSession.getSessionId(), globalSession.getServerId());

            // 같은 서버의 기존 세션
            if (serverId.equals(globalSession.getServerId())) {
                if (sessionManager.hasSession(userId)) {
                    log.warn("같은 서버의 기존 세션 종료: userId={}", userId);
                    sessionManager.closeSession(sessionManager.getSessionByUserId(userId));
                }
            } else {
                // 다른 서버의 기존 세션 → Kafka로 종료 요청
                log.warn("다른 서버({})의 기존 세션 종료 요청 전송", globalSession.getServerId());

                SessionCloseEvent closeEvent = SessionCloseEvent.of(
                        userId,
                        globalSession.getSessionId(),
                        globalSession.getServerId()
                );
                roomEventProducer.publishSessionCloseEvent(closeEvent);
            }
        }

        // 로컬 세션 등록
        sessionManager.registerSession(sessionId, userId);

        // Redis 전역 세션 등록
        roomCacheRepository.registerGlobalSession(userId, sessionId, serverId);

        log.info("WebSocket 연결 성립: sessionId={}, userId={}, serverId={}",
                sessionId, userId, serverId);
    }

    @EventListener
    public void handleWebSocketDisconnectEvent(SessionDisconnectEvent event) {
        StompHeaderAccessor headers = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headers.getSessionId();

        if (sessionId == null) {
            log.warn("세션 ID가 null인 연결 해제 이벤트");
            return;
        }

        Long userId = sessionManager.getUserId(sessionId);

        if (userId == null) {
            log.warn("유저 정보 없는 세션 해제: sessionId={}", sessionId);
            return;
        }

        Long roomId = sessionManager.getRoomBySessionId(sessionId);

        log.info("WebSocket 연결 해제: sessionId={}, userId={}", sessionId, userId);

        // 방 퇴장 처리
        if (roomId != null) {
            log.info("연결 해제로 인한 자동 퇴장 처리: userId={}, roomId={}", userId, roomId);
            String userName = roomCacheRepository.getUserName(roomId, userId);
            roomService.exitRoom(new ExitRoomRequest(userId, userName), roomId);
        }

        // 로컬 세션 정리
        sessionManager.removeSessionData(sessionId);

        // Redis 전역 세션 제거 (같은 세션일 때만)
        GlobalSessionInfo globalSession = roomCacheRepository.getGlobalSession(userId);

        if (globalSession != null && globalSession.getSessionId().equals(sessionId)) {
            roomCacheRepository.removeGlobalSession(userId);
            log.debug("Redis 전역 세션 제거: userId={}, sessionId={}", userId, sessionId);
        } else {
            log.debug("Redis 전역 세션 유지 (다른 세션이 등록됨): userId={}", userId);
        }

        log.debug("세션 정리 완료: sessionId={}, userId={}", sessionId, userId);
    }


}
