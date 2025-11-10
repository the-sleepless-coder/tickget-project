package com.ticketing.queue.service;

import com.ticketing.entity.Match;
import com.ticketing.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.logging.log4j.core.config.plugins.validation.constraints.Required;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class MatchStatusChanger {
    private final MatchRepository matchRepository;
    private final StringRedisTemplate redis;
    private final BotClientService botClient;

    private static final String MATCH_STATUS_KEY = "match:%s:status";
    private static final String DEDUP_KEY       = "match:%s:playing:done";
    private static final String OPEN            = "OPEN";
    private static final int EXPIRE_MINUTES = 35;

    // 트랜잭션 분리: 예약 실행은 별 트랜잭션으로
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void runStartFlow(Long matchId, Long roomId, LocalDateTime startedAt, int botCount, String difficulty, Long hallId) {

        // ✅ 멱등성: 여러 노드에서 동시에 실행되더라도 1번만 처리
        String dedupKey = DEDUP_KEY.formatted(matchId);
        Boolean first = redis.opsForValue().setIfAbsent(dedupKey, "1", java.time.Duration.ofMinutes(EXPIRE_MINUTES));
        if (Boolean.FALSE.equals(first)) return; // 이미 처리 완료

        // 1) DB 상태 변경 (WAITING → PLAYING일 때만)
        Match m = matchRepository.findById(matchId).orElse(null);
        if (m == null) return;
        if (m.getStatus() == Match.MatchStatus.WAITING) {
            m.setStatus(Match.MatchStatus.PLAYING);
            matchRepository.save(m);
        }

        // 2) ✅ 로봇(봇 서버)에게 시작 알림 전송
        try {
            botClient.sendBotRequest(matchId, botCount, startedAt, difficulty, hallId);
            log.debug("Succesfully sent request to bot");
        } catch (Exception ex) {
            // 필요 시 재시도/보상 로직 연결 (DLQ, 재시도 큐 등)
            // 로그만 남기고 종료할지, 예외를 던져 롤백할지는 정책에 따라 결정
            // 여기서는 로그만:
            log.error("Bot notify failed. roomId={} matchId={}", roomId, matchId, ex);
        }

        // 3) Redis 키 설정
        String statusKey = MATCH_STATUS_KEY.formatted(matchId);
        redis.opsForValue().set(statusKey, OPEN);
        redis.expire(statusKey, Duration.ofMinutes(EXPIRE_MINUTES));
    }


}
