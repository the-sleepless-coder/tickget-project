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

    // sessionId -> SessionInfo (메인 저장소)
    private final Map<String, SessionInfo> sessionStore = new ConcurrentHashMap<>();

    // userId -> sessionId (빠른 조회를 위한 인덱스)
    private final Map<Long, String> userIndex = new ConcurrentHashMap<>();


    //새로운 세션 등록
    public void register(String sessionId, Long userId, WebSocketSession session) {
        SessionInfo sessionInfo = SessionInfo.builder()
                .sessionId(sessionId)
                .userId(userId)
                .session(session)
                .build();

        sessionStore.put(sessionId, sessionInfo);
        userIndex.put(userId, sessionId);

        log.info("세션 등록: sessionId={}, userId={}", sessionId, userId);
    }


    //sessionId로 sessionInfo 조회
    public SessionInfo getBySessionId(String sessionId) {
        SessionInfo sessionInfo = sessionStore.get(sessionId);
        if (sessionInfo == null) {
            log.debug("세션을 찾을 수 없음: sessionId={}", sessionId);
        }
        return sessionInfo;
    }

    //userId로 세션 정보 조회
    public SessionInfo getByUserId(Long userId) {
        String sessionId = userIndex.get(userId);
        if (sessionId == null) {
            log.debug("유저의 세션을 찾을 수 없음: userId={}", userId);
            return null;
        }
        return sessionStore.get(sessionId);
    }

    //sessionId로 userId 조회 (하위 호환성 유지)
    public Long getUserId(String sessionId) {
        SessionInfo info = getBySessionId(sessionId);
        return info != null ? info.getUserId() : null;
    }

    // 세션 삭제
    public void remove(String sessionId) {
        SessionInfo sessionInfo = sessionStore.remove(sessionId);

        if (sessionInfo != null) {
            userIndex.remove(sessionInfo.getUserId());
            log.info("세션 삭제 완료: sessionId={}, userId={}, roomId={}",
                    sessionId, sessionInfo.getUserId(), sessionInfo.getRoomId());
        } else {
            log.warn("삭제할 세션을 찾을 수 없음: sessionId={}", sessionId);
        }
    }

    //방 입장
    public void joinRoom(String sessionId, Long roomId) {
        SessionInfo sessionInfo = sessionStore.get(sessionId);
        if (sessionInfo == null) {
            log.warn("세션을 찾을 수 없어 방 입장 실패: sessionId={}, roomId={}", sessionId, roomId);
            return;
        }

        Long previousRoomId = sessionInfo.getRoomId();
        if (previousRoomId != null && !previousRoomId.equals(roomId)) {
            log.warn("세션 {}이 이미 방 {}에 있었는데 방 {}으로 변경됨", sessionId, previousRoomId, roomId);
        }

        sessionInfo.updateRoom(roomId);
        log.info("세션 방 입장: sessionId={}, roomId={}", sessionId, roomId);
    }

    //방 퇴장
    public void leaveRoom(String sessionId) {
        SessionInfo sessionInfo = sessionStore.get(sessionId);
        if (sessionInfo == null) {
            log.warn("세션을 찾을 수 없어 방 퇴장 실패: sessionId={}", sessionId);
            return;
        }

        Long roomId = sessionInfo.getRoomId();
        if (roomId == null) {
            log.warn("세션 {}이 어떤 방에도 속하지 않음 (방 퇴장 시도)", sessionId);
        } else {
            sessionInfo.clearRoom();
            log.info("세션 방 퇴장: sessionId={}, roomId={}", sessionId, roomId);
        }
    }

    //sessionId로 현재 방 조회
    public Long getRoomBySessionId(String sessionId) {
        SessionInfo sessionInfo = sessionStore.get(sessionId);
        if (sessionInfo == null) {
            log.debug("세션을 찾을 수 없음: sessionId={}", sessionId);
            return null;
        }
        return sessionInfo.getRoomId();
    }


}




