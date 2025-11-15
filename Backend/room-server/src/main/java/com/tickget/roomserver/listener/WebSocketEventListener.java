package com.tickget.roomserver.listener;

import com.tickget.roomserver.domain.repository.RoomCacheRepository;
import com.tickget.roomserver.dto.cache.DisconnectInfo;
import com.tickget.roomserver.dto.cache.GlobalSessionInfo;
import com.tickget.roomserver.dto.request.ExitRoomRequest;
import com.tickget.roomserver.event.SessionCloseEvent;
import com.tickget.roomserver.kafka.RoomEventProducer;
import com.tickget.roomserver.service.RoomService;
import com.tickget.roomserver.session.WebSocketSessionManager;
import com.tickget.roomserver.util.ServerIdProvider;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
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

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(10);
    private final Map<Long, ScheduledFuture<?>> pendingCleanups = new ConcurrentHashMap<>();

    private static final long GRACE_PERIOD_MS = 5000;

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

            // 1. Redis에서 재연결 정보 조회
            DisconnectInfo disconnectInfo = roomCacheRepository.getDisconnectInfo(userId);

            if (disconnectInfo != null && disconnectInfo.isWithinGracePeriod(GRACE_PERIOD_MS)) {
                // 5초 이내 재연결
                handleReconnection(sessionId, userId, serverId, connectHeaders, disconnectInfo);
                return;
            }


            // 2.기존 세션 확인 및 종료 처리 - 중복연결 처리
            boolean hadExistingSession = handleExistingSession(userId);

            // 기존 세션이 있었던 경우에만 대기
            if (hadExistingSession) {
                Thread.sleep(200);
                log.debug("기존 세션 종료 처리 대기 완료: userId={}", userId);
            }
            // 3. WebSocketSession 객체 가져오기
            WebSocketSession webSocketSession = getWebSocketSession(connectHeaders);

            // 4. 새 세션 등록 (로컬)
            sessionManager.register(sessionId, userId, webSocketSession);

            // 5. 전역 세션 등록 (Redis)
            roomCacheRepository.registerGlobalSession(userId, sessionId, serverId);

            log.info("WebSocket 연결 성립: sessionId={}, userId={}, serverId={}",
                    sessionId, userId, serverId);

        } catch (Exception e) {
            log.error("WebSocket 연결 처리 중 오류: sessionId={}, userId={}", sessionId, userId, e);
            // 연결 실패 시 정리
            cleanupFailedConnection(sessionId, userId);
        }
    }

    // 재연결 처리
    private void handleReconnection(
            String newSessionId,
            Long userId,
            String newServerId,
            StompHeaderAccessor connectHeaders,
            DisconnectInfo oldInfo
    ) {
        log.info("재연결 감지! userId={}, 기존 서버={}, 새 서버={}, 기존 roomId={}, 경과시간={}ms",
                userId, oldInfo.getOldServerId(), newServerId, oldInfo.getRoomId(),
                System.currentTimeMillis() - oldInfo.getDisconnectTime());

        try {
            // 1. Redis에서 재연결 정보 삭제
            roomCacheRepository.deleteDisconnectInfo(userId);

            // 2. 정리 스케줄 취소 (같은 서버인 경우)
            if (newServerId.equals(oldInfo.getOldServerId())) {
                ScheduledFuture<?> pendingCleanup = pendingCleanups.remove(userId);
                if (pendingCleanup != null) {
                    pendingCleanup.cancel(false);
                    log.debug("정리 스케줄 취소: userId={}", userId);
                }
            } else {
                log.info("다른 서버로 재연결: {} → {}", oldInfo.getOldServerId(), newServerId);
                // 다른 서버의 스케줄은 Redis 확인으로 자동 처리됨
            }

            // 3. WebSocketSession 객체 가져오기
            WebSocketSession webSocketSession = getWebSocketSession(connectHeaders);

            // 4. 새 세션 등록
            sessionManager.register(newSessionId, userId, webSocketSession);

            // 5. 기존 roomId 복구 ✅
            if (oldInfo.getRoomId() != null) {
                sessionManager.joinRoom(newSessionId, oldInfo.getRoomId());
                log.info("방 정보 복구: userId={}, roomId={}", userId, oldInfo.getRoomId());
            }

            // 6. 전역 세션 업데이트 (Redis)
            roomCacheRepository.registerGlobalSession(userId, newSessionId, newServerId);

            log.info("재연결 완료! userId={}, newSessionId={}, newServerId={}, roomId={}",
                    userId, newSessionId, newServerId, oldInfo.getRoomId());

        } catch (Exception e) {
            log.error("재연결 처리 중 오류: userId={}", userId, e);
            cleanupFailedConnection(newSessionId, userId);
        }
    }

    /**
     * 기존 세션 확인 및 종료 처리
     * 핵심 변경사항:
     * - sessionManager.remove()를 호출하지 않음!
     * - close()만 호출하여 disconnect 이벤트가 자연스럽게 발생하도록 함
     * - disconnect 이벤트에서 방 퇴장 + 세션 정리가 완전히 처리됨
     */
    private boolean handleExistingSession(Long userId) {
        GlobalSessionInfo globalSession = roomCacheRepository.getGlobalSession(userId);

        if (globalSession == null) {
            log.debug("유저 {}의 기존 전역 세션 없음", userId);
            return false;
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
        return true;
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
        String serverId = serverIdProvider.getServerId();

        log.info("WebSocket 연결 해제: sessionId={}, userId={}, roomId={}", sessionId, userId, roomId);

        try {
            // 1. Redis에 재연결 정보 저장
            if (roomId != null) {
                String userName = roomCacheRepository.getUserName(roomId, userId);

                DisconnectInfo disconnectInfo = DisconnectInfo.of( serverId, sessionId, roomId, userName);
                roomCacheRepository.saveDisconnectInfo(userId, disconnectInfo);

                log.info("재연결 정보 Redis 저장: userId={}, roomId={}", userId, roomId);
            }

            // 2. 로컬 세션 제거
            sessionManager.remove(sessionId);

            // 3. Redis 전역 세션 제거
            boolean removed = roomCacheRepository.removeGlobalSession(userId, sessionId);

            if (removed) {
                log.debug("Redis 전역 세션 제거: userId={}, sessionId={}", userId, sessionId);
            }

            // 4. 5초 후 정리 스케줄 예약 (로컬)
            ScheduledFuture<?> cleanupFuture = scheduler.schedule(() -> {
                performDelayedCleanup(userId, roomId);
            }, GRACE_PERIOD_MS, TimeUnit.MILLISECONDS);

            pendingCleanups.put(userId, cleanupFuture);

            log.info("5초 후 정리 예약: userId={}, roomId={}", userId, roomId);

        } catch (Exception e) {
            log.error("방 퇴장 처리 중 오류: userId={}, roomId={}", userId, roomId, e);
            // 예외 발생해도 계속 진행 (세션 정리는 반드시 수행)
        } finally {
            // 세션 정리는 반드시 수행 (try-finally로 보장)
            cleanupSession(sessionId, userId);
        }
    }

    private void performDelayedCleanup(Long userId, Long roomId) {
        try {
            pendingCleanups.remove(userId);

            // 1. Redis에서 재연결 정보 확인
            DisconnectInfo info = roomCacheRepository.getDisconnectInfo(userId);

            if (info == null) {
                log.info("이미 재연결되어 정리됨: userId={}", userId);
                return;
            }

            // 2. TTL이 만료되지 않았다면 여전히 유효 (다른 서버에서 재연결 중일 수 있음)
            if (info.isWithinGracePeriod(GRACE_PERIOD_MS)) {
                log.debug("재연결 대기 중, 정리 생략: userId={}", userId);
                return;
            }

            log.info("5초 경과, 방 퇴장 처리 시작: userId={}, roomId={}", userId, roomId);

            // 3. Redis에서 재연결 정보 삭제
            roomCacheRepository.deleteDisconnectInfo(userId);

            // 4. 방 퇴장 처리
            if (roomId != null) {
                try {
                    roomService.exitRoom(new ExitRoomRequest(userId, info.getUserName()), roomId);
                    log.info("자동 퇴장 완료: userId={}, roomId={}", userId, roomId);
                } catch (Exception e) {
                    log.error("자동 퇴장 처리 실패: userId={}, roomId={}", userId, roomId, e);
                }
            }

        } catch (Exception e) {
            log.error("지연 정리 중 오류: userId={}, roomId={}", userId, roomId, e);
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