package com.tickget.roomserver.service;

import com.tickget.roomserver.domain.repository.RoomCacheRepository;
import com.tickget.roomserver.dto.cache.QueueStatus;
import com.tickget.roomserver.kafaka.RoomEventMessage;
import com.tickget.roomserver.session.WebSocketSessionManager;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import jakarta.annotation.PreDestroy;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class RoomNotificationScheduler {

    private final WebSocketSessionManager sessionManager;
    private final RoomCacheRepository roomCacheRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // roomId -> ScheduledFuture 매핑
    private final ConcurrentHashMap<Long, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();

    // 스케줄러 실행을 위한 ExecutorService
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(10);

    public RoomNotificationScheduler(
            WebSocketSessionManager sessionManager,
            RoomCacheRepository roomCacheRepository,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.sessionManager = sessionManager;
        this.roomCacheRepository = roomCacheRepository;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * 방의 대기열 상태 알림 스케줄링 시작
     * @param roomId 방 ID
     */
    public void startScheduling(Long roomId) {
        // 이미 스케줄링이 시작된 경우 중복 방지
        if (scheduledTasks.containsKey(roomId)) {
            log.warn("방 {}의 알림 스케줄링이 이미 실행 중입니다.", roomId);
            return;
        }

        log.info("방 {} 대기열 상태 알림 스케줄링 시작", roomId);

        // 1초 간격으로 주기적 실행
        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(
                () -> notifyQueueStatus(roomId),
                0,  // 초기 딜레이 0초 (즉시 시작)
                1,  // 1초 간격
                TimeUnit.SECONDS
        );

        scheduledTasks.put(roomId, future);
        log.info("방 {} 알림 스케줄링 등록 완료", roomId);
    }

    /**
     * 방의 대기열 상태 알림 스케줄링 중단
     * @param roomId 방 ID
     */
    public void stopScheduling(Long roomId) {
        ScheduledFuture<?> future = scheduledTasks.remove(roomId);

        if (future != null) {
            future.cancel(false);  // 현재 실행 중인 작업은 완료되도록 함
            log.info("방 {} 대기열 상태 알림 스케줄링 중단", roomId);
        } else {
            log.debug("방 {}의 스케줄링이 존재하지 않음 (이미 중단됨)", roomId);
        }
    }

    /**
     * 실제 대기열 상태 알림 전송 로직
     * @param roomId 방 ID
     */
    private void notifyQueueStatus(Long roomId) {
        try {
            // 1. 이 서버에 연결된 해당 방의 세션들 조회
            List<WebSocketSession> sessions = sessionManager.getSessionsByRoom(roomId);

            if (sessions.isEmpty()) {
                log.debug("방 {}에 연결된 세션이 없음", roomId);
                return;
            }

            // 2. 방의 매치 ID 조회
            Long matchId = roomCacheRepository.getMatchIdByRoomId(roomId);

            if (matchId == null) {
                log.debug("방 {}의 매치 ID를 찾을 수 없음 (매치 생성 전일 수 있음)", roomId);
                return;
            }

            // 3. 이 서버에 연결된 모든 유저의 대기열 상태를 Map에 수집
            Map<Long, QueueStatus> queueStatusMap = new HashMap<>();
            int collectedCount = 0;

            for (WebSocketSession session : sessions) {
                try {
                    // 세션이 열려있는지 확인
                    if (!session.isOpen()) {
                        continue;
                    }

                    // 세션 ID로 유저 ID 조회
                    Long userId = sessionManager.getUserId(session.getId());

                    if (userId == null) {
                        log.warn("세션 {}의 유저 ID를 찾을 수 없음", session.getId());
                        continue;
                    }

                    // Redis에서 해당 유저의 대기열 상태 조회
                    QueueStatus queueStatus = roomCacheRepository.getQueueStatus(matchId, userId);

                    if (queueStatus != null) {
                        queueStatusMap.put(userId, queueStatus);
                        collectedCount++;
                    }

                } catch (Exception e) {
                    log.error("유저별 대기열 상태 수집 중 오류: roomId={}, sessionId={}, error={}",
                            roomId, session.getId(), e.getMessage());
                }
            }

            // 4. 수집된 대기열 정보가 있으면 브로드캐스트
            if (!queueStatusMap.isEmpty()) {
                String destination = "/topic/rooms/" + roomId;

                RoomEventMessage message = RoomEventMessage.queueStatusUpdate(
                        roomId,
                        queueStatusMap
                );

                messagingTemplate.convertAndSend(destination, message);
                log.debug("방 {} 대기열 상태 브로드캐스트 완료: 유저 수={}", roomId, collectedCount);
            } else {
                log.debug("방 {}에 전송할 대기열 상태 없음", roomId);
            }

        } catch (Exception e) {
            log.error("방 {} 대기열 상태 알림 처리 중 오류: error={}", roomId, e.getMessage(), e);
        }
    }

    /**
     * 서버 종료 시 모든 스케줄링 정리
     */
    @PreDestroy
    public void shutdown() {
        log.info("RoomNotificationScheduler 종료 시작");

        // 모든 스케줄링 작업 중단
        scheduledTasks.forEach((roomId, future) -> {
            future.cancel(false);
            log.debug("방 {} 스케줄링 종료", roomId);
        });

        scheduledTasks.clear();

        // ExecutorService graceful shutdown
        scheduler.shutdown();

        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
            log.info("RoomNotificationScheduler 종료 완료");
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
            log.warn("RoomNotificationScheduler 강제 종료");
        }
    }
}