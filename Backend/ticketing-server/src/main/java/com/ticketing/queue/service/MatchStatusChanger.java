package com.ticketing.queue.service;

import com.ticketing.entity.Match;
import com.ticketing.repository.MatchCacheRepository;
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

@Slf4j
@Service
@RequiredArgsConstructor
public class MatchStatusChanger {
    private final MatchRepository matchRepository;
    private final StringRedisTemplate redis;
    private final ClientService Client;

    private static final String MATCH_STATUS_KEY = "match:%s:status";
    private static final String DEDUP_KEY       = "match:%s:playing:done";
    private static final String OPEN            = "OPEN";
    private static final String USER_NUMBER_COUNT = "humanusers:match:%s";
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

        // 2) 매치 게임 상태 Redis 키 설정
        String statusKey = MATCH_STATUS_KEY.formatted(matchId);
        redis.opsForValue().set(statusKey, OPEN);
        redis.expire(statusKey, Duration.ofMinutes(EXPIRE_MINUTES));

        // 3) 매치에 참여한 인원에 대한 Redis 키 설정
        ResponseEntity<?> response = Client.getUserNum(roomId);
        if(response.getStatusCode().is2xxSuccessful()){
            Integer userNum = (Integer) response.getBody();
            String userNumString="";
            if(userNum!=null){
                userNumString = String.valueOf(userNum);
            }
            String userNumKey = USER_NUMBER_COUNT.formatted(matchId);
            redis.opsForValue().set(userNumKey, userNumString);
            redis.expire(userNumKey, Duration.ofMinutes(EXPIRE_MINUTES));

            log.info("현재 사용자의 수 {}", userNum);
        }else{
            log.info("사용자 수를 못 가져왔습니다.");
        }

        // 4) room 서버에 시작했다는 사실 알림
        try{
            Client.changeStartState(roomId);
            log.info(" room 서버의 게임 상태가 PLAYING으로 바뀌었습니다. ");

        }catch(Exception e){
            e.printStackTrace();
            log.info(" room 서버의 게임 상태가 바뀌지 못했습니다. ");
        }



    }


}
