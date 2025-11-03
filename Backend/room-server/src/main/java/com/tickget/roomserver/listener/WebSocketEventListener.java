package com.tickget.roomserver.listener;

import com.tickget.roomserver.domain.repository.RoomCacheRepository;
import com.tickget.roomserver.dto.request.ExitRoomRequest;
import com.tickget.roomserver.service.RoomService;
import com.tickget.roomserver.session.WebSocketSessionManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
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
    private final RoomService roomService; // TODO: 나중에 추가
    private final RoomCacheRepository roomCacheRepository;

    // 소켓 연결 시 (SessionConnectedEvent 발생 시)
    @EventListener
    public void handleWebSocketConnectEvent(SessionConnectedEvent event) {
        StompHeaderAccessor headers = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headers.getSessionId();

        //TODO: JWT에서 유저 ID 추출
        Long userId = generateTempUserId(sessionId); // 현재 임시로 세션ID 기반으로 유저 ID 생성

        //기존에 세션이 있다면 끊고 새 새션만 유지
        if (sessionManager.hasSession(userId)){
            log.warn("유저 {}의 기존 세션 감지. 기존 세션 종료", userId);
            sessionManager.closeSession(sessionManager.getSessionByUserId(userId));
        }

        sessionManager.registerSession(sessionId, userId);
        //TODO: Redis에 전역 세션 등록
        log.info("WebSocket 연결 성립: sessionId={}, userId={}", sessionId, userId);
        //TODO: 연결 성공 메시지 전송
    }

    @EventListener
    public void handleWebSocketDisconnectEvent(SessionDisconnectEvent event) {
        StompHeaderAccessor headers = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headers.getSessionId();

        if (sessionId == null) {
            log.warn("세션 ID가 null인 연결 해제 이벤트");
            return;
        }

        // 세션에서 유저 ID 조회
        Long userId = sessionManager.getUserId(sessionId);

        if (userId == null) {
            log.warn("유저 정보 없는 세션 해제: sessionId={}", sessionId);
            return;
        }
        Long roomId = sessionManager.getRoomBySessionId(sessionId);

        log.debug("WebSocket 연결 해제: sessionId={}, userId={}", sessionId, userId);

        // 1. 비즈니스 로직: 방 퇴장 처리
        if (roomId != null) {
            log.debug("연결 해제로 인한 자동 퇴장 처리: userId={}, roomId={}", userId, roomId);
            String userName = roomCacheRepository.getUserName(roomId, userId);

            roomService.exitRoom(new ExitRoomRequest(userId, userName), roomId);
        }

        // 2. 데이터 정리: 세션 정보 제거
        sessionManager.removeSessionData(sessionId);

        log.debug("세션 정리 완료: sessionId={}, userId={}", sessionId, userId);
    }

    private Long generateTempUserId(String sessionId) {
        return (long) Math.abs(sessionId.hashCode());
    }


}
