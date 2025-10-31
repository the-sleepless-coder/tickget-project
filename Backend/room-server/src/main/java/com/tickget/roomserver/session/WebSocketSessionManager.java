package com.tickget.roomserver.session;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
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


 /* 관리하는 매핑:
 *  1. sessionId ↔ WebSocketSession (WebSocket 연결)
 * 2. sessionId ↔ userId (WebSocket 연결 ↔ 사용자)
 * 3. userId ↔ roomId (사용자 ↔ 방)
 * 4. roomId ↔ Set<userId> (방 ↔ 방에 속한 사용자들)
 * */

    // sessionId -> WebSocketSession
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    // userId -> sessionId
    private final Map<Long, String> userToSession = new ConcurrentHashMap<>();

    // sessionId -> userId
    private final Map<String, Long> sessionToUser = new ConcurrentHashMap<>();

//    // sessionId - > roomId;
    private final Map<String,Long> sessionToRoom = new ConcurrentHashMap<>();
//
//    // roomId -> Set<userId>
//    private final Map<Long, Set<Long>> roomUsers = new ConcurrentHashMap<>();
//
//    // userId -> roomId (한 유저는 한 방에만)
//    private final Map<Long, Long> userToRoom = new ConcurrentHashMap<>();
//
//    // userId -> userName
//    private final Map<Long, String> userToName = new ConcurrentHashMap<>();

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


    //세션데이터 삭제: section이 닫힌 상황에서만 호출됨
    public void removeSessionData(String sessionId) {
        Long userId = sessionToUser.remove(sessionId);

        if (userId != null) {
            userToSession.remove(userId);
            sessions.remove(sessionId);
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


    // 전체 연결 수
    public int getConnectionCount() {
        return sessions.size();
    }

    //디버깅용 메서드 - 현재 상태 출력
    public void printStatus() {
        log.info("=== WebSocket Session Manager Status ===");
        log.info("총 연결 수: {}", sessions.size());
    }



}




