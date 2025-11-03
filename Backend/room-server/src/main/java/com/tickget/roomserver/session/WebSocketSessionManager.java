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
            log.debug("유저 {}의 기존 세션 {} 제거", userId, oldSessionId);
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
    }

    // 유저 세션 존재 확인
    public boolean hasSession(Long userId) {
        return userToSession.containsKey(userId);
    }

    // 유저 id로 세션id 조회
    public String getSessionIdByUserId(Long userId) {
        return userToSession.get(userId);
    }

    //세션 id로 유저id 조회
    public Long getUserId(String sessionId) {
        return sessionToUser.get(sessionId);
    }

    //유저 id로 세션 조회
    public WebSocketSession getSessionByUserId(Long userId) {
        String sessionId = userToSession.get(userId);
        if(sessionId == null){
            return null;
        }
        return sessions.get(sessionId);
    }

    // 세션 id로 세션 조회
    public WebSocketSession getSessionBySessionId(String sessionId) {
        return sessions.get(sessionId);
    }

    // 유저를 방에 추가
    public void joinRoom(String sessionId, Long roomId) {
        sessionToRoom.put(sessionId, roomId);
        log.info("세션 방 추가: sessionId={}, roomId={}", sessionId, roomId);
    }

    // 유저를 방에서 제거
    public void leaveRoom(String sessionId) {
        Long roomId = sessionToRoom.remove(sessionId);
        log.info("세션 방 제거: sessionId={}, roomId={}", sessionId, roomId);
    }

    // 웹소켓 sessionId로 방 조회
    public Long getRoomBySessionId(String sessionId) {
        return sessionToRoom.get(sessionId);
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
            userToSession.remove(userId);
            sessions.remove(sessionId);
            sessionToRoom.remove(sessionId);
            log.info("세션 데이터 삭제: sessionId={}, userId={}", sessionId, userId);
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




