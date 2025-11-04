package com.tickget.roomserver.session;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.socket.WebSocketSession;

/*
소켓 등록 및 삭제/관리 등을 하는 클래스
*/
@Slf4j
@Component
@RequestMapping
public class WebSocketSessionManager {

    // sessionId -> WebSocketSession
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    // userId -> sessionId
    private final Map<Long, String> userToSession = new ConcurrentHashMap<>();

    // sessionId -> userId
    private final Map<String, Long> sessionToUser = new ConcurrentHashMap<>();

   // sessionId - > roomId;
    private final Map<String,Long> sessionToRoom = new ConcurrentHashMap<>();

    //새롭게 세션등록
    public void registerSession(String sessionId, Long userId){

        //기존 세션이 있다면 제거.
        if( userToSession.containsKey(userId) ){
            String oldSessionId = userToSession.get(userId);
            log.info("유저 {}의 기존 세션 {} 제거 후 새로운 세션 {} 등록", userId, oldSessionId, sessionId);
            WebSocketSession oldSession = sessions.get(oldSessionId);
            closeSession(oldSession);
        }

        userToSession.put(userId, sessionId);
        sessionToUser.put(sessionId, userId);

        log.info("세션 등록: sessionId={}, userId={}", sessionId, userId);
    }

    // WebSocketSession 저장
    public void saveSession(String sessionId, WebSocketSession session) {
        sessions.put(sessionId, session);
        log.debug("WebSocketSession 저장됨: sessionId={}", sessionId);
    }

    // 유저 세션 존재 확인
    public boolean hasSession(Long userId) {
        return userToSession.containsKey(userId);
    }

    // 유저 id로 세션id 조회
    public String getSessionIdByUserId(Long userId) {
        String sessionId = userToSession.get(userId);
        if (sessionId == null) {
            log.warn("유저 {}의 세션을 찾을 수 없음", userId);
        }
        return sessionId;
    }

    //세션 id로 유저id 조회
    public Long getUserId(String sessionId) {
        Long userId = sessionToUser.get(sessionId);
        if (userId == null) {
            log.warn("세션 {}의 유저 정보를 찾을 수 없음", sessionId);
        }
        return userId;
    }

    //유저 id로 세션 조회
    public WebSocketSession getSessionByUserId(Long userId) {
        String sessionId = userToSession.get(userId);
        if(sessionId == null){
            log.warn("유저 {}의 세션ID를 찾을 수 없음", userId);
            return null;
        }
        WebSocketSession session = sessions.get(sessionId);
        if (session == null) {
            log.warn("유저 {}의 세션객체를 찾을 수 없음 (sessionId={})", userId, sessionId);
        }
        return session;
    }

    // 세션 id로 세션 조회
    public WebSocketSession getSessionBySessionId(String sessionId) {
        WebSocketSession session = sessions.get(sessionId);
        if (session == null) {
            log.warn("세션 {}을 찾을 수 없음", sessionId);
        }
        return session;
    }

    // 유저를 방에 추가
    public void joinRoom(String sessionId, Long roomId) {
        Long previousRoomId = sessionToRoom.get(sessionId);
        if (previousRoomId != null && !previousRoomId.equals(roomId)) {
            log.warn("세션 {}이 이미 방 {}에 있었는데 방 {}으로 변경됨", sessionId, previousRoomId, roomId);
        }
        sessionToRoom.put(sessionId, roomId);
        log.info("세션 방 추가: sessionId={}, roomId={}", sessionId, roomId);
    }

    // 유저를 방에서 제거
    public void leaveRoom(String sessionId) {
        Long roomId = sessionToRoom.remove(sessionId);
        if (roomId == null) {
            log.warn("세션 {}이 어떤 방에도 속하지 않음 (방 제거 시도)", sessionId);
        } else {
            log.info("세션 방 제거: sessionId={}, roomId={}", sessionId, roomId);
        }
    }

    // 웹소켓 sessionId로 방 조회
    public Long getRoomBySessionId(String sessionId) {
        Long roomId = sessionToRoom.get(sessionId);
        if (roomId == null) {
            log.debug("세션 {}이 어떤 방에도 속하지 않음", sessionId);
        }
        return roomId;
    }

    // 특정 방의 모든 세션 조회 (Kafka 메시지 전달용)
    public List<WebSocketSession> getSessionsByRoom(Long roomId) {
        return sessionToRoom.entrySet().stream()
                .filter(entry -> entry.getValue().equals(roomId))
                .map(entry -> sessions.get(entry.getKey()))
                .filter(session -> session != null && session.isOpen())
                .collect(Collectors.toList());
    }


    //세션데이터 삭제: section이 닫힌 상황에서만 호출됨
    public void removeSessionData(String sessionId) {
        Long userId = sessionToUser.remove(sessionId);

        if (userId != null) {
            String removedSessionId = userToSession.remove(userId);
            sessions.remove(sessionId);
            Long removedRoomId = sessionToRoom.remove(sessionId);

            log.info("세션 데이터 삭제 완료: sessionId={}, userId={}, roomId={}",
                    sessionId, userId, removedRoomId);
        } else {
            log.warn("세션 데이터 삭제 시도했으나 유저 정보 없음: sessionId={}", sessionId);
        }

    }

    //세션 닫기
    public void closeSession(WebSocketSession session) {
        if (session.isOpen()) {
            try {
                session.close();
                log.debug("세션 종료: {}", session.getId());
            } catch (Exception e) {
                log.warn("세션 종료 중 오류: sessionId={}, error={}",
                        session.getId(), e.getMessage());
            }
        }
    }

    //디버깅용 메서드 - 현재 상태 출력
    public void printStatus() {
        log.info("=== WebSocket Session Manager Status ===");
        log.info("총 연결 수: {}", sessions.size());
    }



}




