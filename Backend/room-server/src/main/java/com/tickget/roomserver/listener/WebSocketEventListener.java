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
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * 웹소켓 이벤트 리스너
 * - 연결/해제 이벤트 처리 및 비즈니스 로직 담당
 * - 중복 세션 처리, 방 입/퇴장 관리
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

    //웹소켓 연결 이벤트 처리
    @EventListener
    public void handleWebSocketConnectEvent(SessionConnectedEvent event) {
        StompHeaderAccessor headers = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headers.getSessionId();

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

        try {
            // 1. 기존 세션 확인 및 종료 처리
            handleExistingSession(userId);

            // 2. WebSocketSession 객체 가져오기
            WebSocketSession webSocketSession = getWebSocketSession(connectHeaders);

            // 3. 새 세션 등록 (로컬)
            sessionManager.register(sessionId, userId, webSocketSession);

            // 4. 전역 세션 등록 (Redis)
            roomCacheRepository.registerGlobalSession(userId, sessionId, serverId);

            log.info("WebSocket 연결 성립: sessionId={}, userId={}, serverId={}",
                    sessionId, userId, serverId);

        } catch (Exception e) {
            log.error("WebSocket 연결 처리 중 오류: sessionId={}, userId={}", sessionId, userId, e);
            // 연결 실패 시 정리
            cleanupFailedConnection(sessionId, userId);
        }
    }

    /**
     * 기존 세션 확인 및 종료 처리
     *
     * 핵심 변경사항:
     * - sessionManager.remove()를 호출하지 않음!
     * - close()만 호출하여 disconnect 이벤트가 자연스럽게 발생하도록 함
     * - disconnect 이벤트에서 방 퇴장 + 세션 정리가 완전히 처리됨
     */
    private void handleExistingSession(Long userId) {
        GlobalSessionInfo globalSession = roomCacheRepository.getGlobalSession(userId);

        if (globalSession == null) {
            log.debug("유저 {}의 기존 전역 세션 없음", userId);
            return;
        }

        log.warn("유저 {}의 기존 전역 세션 발견 - sessionId: {}, serverId: {}",
                userId, globalSession.getSessionId(), globalSession.getServerId());

        // 같은 서버든 다른 서버든 동일하게 Kafka 발행
        SessionCloseEvent closeEvent = SessionCloseEvent.of(
                userId,
                globalSession.getSessionId(),
                globalSession.getServerId(),
                globalSession.getVersion()
        );

        roomEventProducer.publishSessionCloseEvent(closeEvent);

        log.info("기존 세션 종료 요청 발행: userId={}, targetServerId={}",
                userId, globalSession.getServerId());
    }

    //WebSocketSession 객체 추출
    private WebSocketSession getWebSocketSession(StompHeaderAccessor headers) {
        return (WebSocketSession) headers.getHeader("simpSession");
    }

    //연결 실패 시 정리
    private void cleanupFailedConnection(String sessionId, Long userId) {
        try {
            sessionManager.remove(sessionId);
            roomCacheRepository.removeGlobalSession(userId,sessionId);
        } catch (Exception e) {
            log.error("연결 실패 정리 중 오류: sessionId={}, userId={}", sessionId, userId, e);
        }
    }

    // 소켓 연결 해제 이벤트 처리
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

        log.info("WebSocket 연결 해제: sessionId={}, userId={}, roomId={}", sessionId, userId, roomId);

        try {
            // 방 퇴장 처리 (예외 발생 가능)
            if (roomId != null) {
                log.info("연결 해제로 인한 자동 퇴장 처리: userId={}, roomId={}", userId, roomId);
                String userName = roomCacheRepository.getUserName(roomId, userId);
                roomService.exitRoom(new ExitRoomRequest(userId, userName), roomId);
            }
        } catch (Exception e) {
            log.error("방 퇴장 처리 중 오류: userId={}, roomId={}", userId, roomId, e);
            // 예외 발생해도 계속 진행 (세션 정리는 반드시 수행)
        } finally {
            // 세션 정리는 반드시 수행 (try-finally로 보장)
            cleanupSession(sessionId, userId);
        }
    }

    //finally 블록에서 호출되므로 반드시 실행됨
    private void cleanupSession(String sessionId, Long userId) {
        try {
            // 1. 로컬 세션 제거
            sessionManager.remove(sessionId);

            // 2. Redis 전역 세션 제거 (Lua Script - 원자적)
            // sessionId가 일치하는 경우에만 삭제됨
            boolean removed = roomCacheRepository.removeGlobalSession(userId, sessionId);

            if (removed) {
                log.debug("Redis 전역 세션 제거: userId={}, sessionId={}", userId, sessionId);
            } else {
                log.debug("Redis 전역 세션 유지 (다른 세션이 등록됨): userId={}", userId);
            }

            log.debug("세션 정리 완료: sessionId={}, userId={}", sessionId, userId);

        } catch (Exception e) {
            log.error("세션 정리 중 오류: sessionId={}, userId={}", sessionId, userId, e);
        }
    }
}