package com.tickget.roomserver.session;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
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


    /*
    여기 만들어놓은 다양한 Map을
    통해서 원하는 값 편하게 조회하는 유틸성 메서드 만들 수 있음
    */

    // sessionId -> WebSocketSession
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    // userId -> sessionId
    private final Map<Long, String> userToSession = new ConcurrentHashMap<>();

    // sessionId -> userId
    private final Map<String, Long> sessionToUser = new ConcurrentHashMap<>();

    // roomId -> Set<userId>
    private final Map<Long, Set<Long>> roomUsers = new ConcurrentHashMap<>();

    // userId -> roomId (한 유저는 한 방에만)
    private final Map<Long, Long> userToRoom = new ConcurrentHashMap<>();

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

            // 방에서도 제거
            Long roomId = userToRoom.remove(userId);
            if (roomId != null) {
                Set<Long> users = roomUsers.get(roomId);
                if (users != null) {
                    users.remove(userId);
                    if (users.isEmpty()) {
                        roomUsers.remove(roomId);
                    }
                }
            }

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

    // 유저를 방에 추가
    public void addUserToRoom(Long userId, Long roomId) {
        // 기존 방에서 제거
        Long oldRoomId = userToRoom.get(userId);
        if (oldRoomId != null && !oldRoomId.equals(roomId)) {
            removeUserFromRoom(userId, oldRoomId);
        }

        // 새 방에 추가
        userToRoom.put(userId, roomId);
        roomUsers.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(userId);

        log.info("유저 방 추가: userId={}, roomId={}", userId, roomId);
    }

    // 유저를 방에서 제거
    public void removeUserFromRoom(Long userId, Long roomId) {
        userToRoom.remove(userId);

        Set<Long> users = roomUsers.get(roomId);
        if (users != null) {
            users.remove(userId);
            if (users.isEmpty()) {
                roomUsers.remove(roomId);
            }
        }

        log.info("유저 방 제거: userId={}, roomId={}", userId, roomId);
    }

    //방의 모든 유저 조회
    public List<Long> getUsersInRoom(Long roomId) {
        Set<Long> users = roomUsers.get(roomId);
        if (users == null) {
            return Collections.emptyList();
        }
        return new ArrayList<>(users);
    }

    // 유저가 속한 방 조회
    public Long getRoomByUser(Long userId) {
        return userToRoom.get(userId);
    }

    // 전체 연결 수
    public int getConnectionCount() {
        return sessions.size();
    }

    //전체 방 수
    public int getRoomCount() {
        return roomUsers.size();
    }

    //디버깅용 메서드 - 현재 상태 출력
    public void printStatus() {
        log.info("=== WebSocket Session Manager Status ===");
        log.info("총 연결 수: {}", sessions.size());
        log.info("총 방 수: {}", roomUsers.size());

        roomUsers.forEach((roomId, users) -> {
            log.info("방 {}: {} 명", roomId, users.size());
        });
    }



}




