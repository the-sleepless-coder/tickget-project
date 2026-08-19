package com.ticketing.queue.service;

import com.ticketing.entity.Match;
import com.ticketing.queue.exception.MatchStartFlowException;
import com.ticketing.queue.exception.MatchStatusRedisSaveFailedException;
import com.ticketing.queue.exception.MatchStatusSaveFailedException;
import com.ticketing.queue.outbox.BotCancelOutboxWriter;
import com.ticketing.queue.outbox.RoomCancelOutboxWriter;
import com.ticketing.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class MatchStatusChanger {
    private final MatchRepository matchRepository;
    private final StringRedisTemplate redis;
    private final ClientService Client;
    private final RoomCancelOutboxWriter roomCancelOutboxWriter;
    private final BotCancelOutboxWriter botCancelOutboxWriter;

    private static final String MATCH_STATUS_KEY = "match:%s:status";
    private static final String DEDUP_KEY       = "match:%s:playing:done";
    private static final String OPEN            = "OPEN";
    private static final String USER_NUMBER_COUNT = "humanusers:match:%s";
    private static final int EXPIRE_MINUTES = 35;

    // 트랜잭션 분리: 예약된 실행은 별도 트랜잭션으로 처리
    @Transactional(propagation = Propagation.REQUIRED)
    public void runStartFlow(Long matchId, Long roomId, LocalDateTime startedAt, int botCount, String difficulty, Long hallId) {
        
        // 1)Redis에 멱등성키 설정: 여러 노드에서 경기에 대해 동시에 실행되더라도 1번만 처리
        String dedupKey = DEDUP_KEY.formatted(matchId);
        Boolean first = redis.opsForValue().setIfAbsent(dedupKey, "1", java.time.Duration.ofMinutes(EXPIRE_MINUTES));
        if (Boolean.FALSE.equals(first)) return; // 이미 처리 완료

        Match m = matchRepository.findById(matchId).orElse(null);
        if (m == null) return;
        if (m.getStatus() == Match.MatchStatus.CANCELLED) return;        
        try {
            List<String> redisKeys = new ArrayList<>();
            // 2) DB 상태 변경 (WAITING → PLAYING)
            saveMatchStatus(m);
            // 3) 매치 게임 상태 Redis 키 설정
            saveRedisMatchStatus(matchId, redisKeys);
            // 4) 매치 참여 인원 Redis 키 설정
            saveRedisUserCount(roomId, matchId, m, redisKeys);
            // 5) room 서버에 경기 시작 알림
            notifyRoomServer(roomId);
        } catch (RuntimeException e) {
            // rethrow 하지 않고 같은 트랜잭션 안에서 보상을 완결한다.
            //  → CANCELLED(PLAYING을 덮어씀)와 봇 취소 outbox가 한 트랜잭션으로 원자 커밋된다.
            //    (throw e 로 두면 WAITING으로 롤백돼 방치되므로 안 됨)
            if(e instanceof MatchStartFlowException)
            {
                log.error("경기 시작 실패 - 취소 보상: matchId={}", matchId, e);
            }
            else
            {
                log.error("경기 상태 변경 중 예기치 못한 오류 발생.");
            }
            
            // 보상 트랜잭션 처리.
            compensate(m, matchId, roomId, redisKeys, dedupKey);
        }
    }

    /**
     * 경기 시작 실패 보상 (runStartFlow 트랜잭션 내부에서 완결).
     *
     * room/봇/매치는 t=0(방 생성)부터 이미 존재하므로, 어느 단계에서 터지든 아래를 전부 실행한다.
     * (runStartFlow가 직접 set한 redis 키만 redisKeys 리스트로 진행분만 정리)
     *  1) DB = CANCELLED  (WAITING 방치 X)
     *  2) 이 실행이 설정한 redis 키 삭제 + dedup 삭제
     *  3) room 에 매치 취소 통지 — start 알림 여부와 무관 (room은 t=0부터 이 매치를 기다림)
     *  4) 봇 취소 이벤트 — t=0에 발송된 봇 teardown (CANCELLED와 원자 커밋 → 전달 보장)
     */
    private void compensate(Match m, Long matchId, Long roomId, List<String> redisKeys, String dedupKey) {
        // 1) DB = CANCELLED
        m.setStatus(Match.MatchStatus.CANCELLED);
        m.setEndedAt(LocalDateTime.now());
        matchRepository.save(m);

        // 2) 설정된 redis 키만 삭제 + dedup
        for (String key : redisKeys) {
            try {
                redis.delete(key);
            } catch (Exception re) {
                log.error("Redis 보상 실패: {}", key, re);
            }
        }
        redis.delete(dedupKey);

        // 3) room 에 매치 취소 통지 — best-effort HTTP 대신 outbox 로 발행 보장
        //    (CANCELLED 저장과 같은 트랜잭션 → 커밋되면 통지도 반드시 전달)
        roomCancelOutboxWriter.enqueue(matchId, roomId);

        // 4) 봇 취소 이벤트 — t=0에 발송된 봇 teardown (CANCELLED와 원자 커밋 → 발행 보장)
        botCancelOutboxWriter.enqueue(matchId);

        log.info("경기 취소 보상 완료: matchId={} → CANCELLED + 봇 취소", matchId);
    }

    // WAITING 상태일 때만 PLAYING으로 변경
    private void saveMatchStatus(Match m) {
        try {
            if (m.getStatus() == Match.MatchStatus.WAITING) {
                m.setStatus(Match.MatchStatus.PLAYING);
                matchRepository.save(m);
            }
        } catch (Exception e) {
            throw new MatchStatusSaveFailedException("매치 상태 DB 저장 실패", e);
        }
    }

    // 매치 게임 상태 키를 Redis에 OPEN으로 설정
    private void saveRedisMatchStatus(Long matchId, List<String> redisKeys) {
        String statusKey = MATCH_STATUS_KEY.formatted(matchId);
        try {
            redis.opsForValue().set(statusKey, OPEN);
            redisKeys.add(statusKey);
            redis.expire(statusKey, Duration.ofMinutes(EXPIRE_MINUTES));
        } catch (Exception e) {
            throw new MatchStatusRedisSaveFailedException("매치 상태 Redis 저장 실패", e);
        }
    }

    // room 서버에서 현재 인원 수를 조회해 Redis와 DB에 저장
    private void saveRedisUserCount(Long roomId, Long matchId, Match m, List<String> redisKeys) {
        ResponseEntity<?> response;
        response = Client.getUserNum(roomId);

        if (!response.getStatusCode().is2xxSuccessful()) {
            log.info("사용자 수를 못 가져왔습니다.");
            return;
        }

        Integer userNum = (Integer) response.getBody();
        if (userNum != null) {
            m.setUserCount(userNum);
            matchRepository.save(m);
            log.info("Match userCount 저장 완료: matchId={}, userCount={}", matchId, userNum);
        }

        String userNumKey = USER_NUMBER_COUNT.formatted(matchId);
        try {
            redis.opsForValue().set(userNumKey, userNum != null ? String.valueOf(userNum) : "");
            redisKeys.add(userNumKey);
            redis.expire(userNumKey, Duration.ofMinutes(EXPIRE_MINUTES));
        } catch (Exception e) {
            throw new MatchStatusRedisSaveFailedException("사용자 수 Redis 저장 실패", e);
        }
        log.info("방ID: {}, 매치ID: {}, 사용자 수: {}", roomId, matchId, userNum);
    }

    // room 서버에 경기 시작 상태 변경 요청
    private void notifyRoomServer(Long roomId) {
        Client.changeStartState(roomId);
        log.info("room 서버의 게임 상태가 PLAYING으로 바뀌었습니다.");
    }
}
