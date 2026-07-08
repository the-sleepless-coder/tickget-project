package com.ticketing.seat.service;

import com.ticketing.entity.Match;
import com.ticketing.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class HandleFullMatchService {

    private final StringRedisTemplate redisTemplate;
    private final MatchRepository matchRepository;
    private final RoomServerClient roomServerClient;
    private final StatsServerClient statsServerClient;

    /**
     * Confirm 시점에서 만석 또는 모든 유저 Confirm으로 경기 종료 처리
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleFullMatchAtConfirm(Long matchId, Match match) {
        try {

            // 멱등성 보장: Redis 락으로 중복 실행 방지
            String finishLockKey = "match:" + matchId + ":finish_lock";
            Boolean acquired = redisTemplate.opsForValue()
                    .setIfAbsent(finishLockKey, "1", Duration.ofSeconds(900));

            if (Boolean.FALSE.equals(acquired)) {
                log.info("이미 경기 종료 처리 중 (스킵): matchId={}", matchId);
                return;
            }

            // DB에서 최신 상태 재확인
            Match freshMatch = matchRepository.findById(matchId).orElse(null);
            if (freshMatch == null || freshMatch.getStatus() == Match.MatchStatus.FINISHED) {
                log.info("이미 종료된 경기 (스킵): matchId={}", matchId);
                return;
            }

            // 1. Redis 카운터에서 통계 수집 및 DB 저장
            saveMatchStatisticsFromRedis(matchId, match);

            // 2. DB 상태 변경
            match.setStatus(Match.MatchStatus.FINISHED);
            match.setEndedAt(LocalDateTime.now());
            matchRepository.save(match);

            // 3. Redis 상태를 CLOSED로 설정
            String statusKey = "match:" + matchId + ":status";
            redisTemplate.opsForValue().set(statusKey, "CLOSED");
            redisTemplate.expire(statusKey, Duration.ofSeconds(900));

            // 4. Redis 정리
            //  cleanupAllMatchRedis(matchId);

            // 5. 외부 서버 알림
            // statsServerClient.notifyMatchEnd(matchId);
            roomServerClient.notifyMatchEnd(match.getRoomId());
            statsServerClient.notifyMatchEnd(matchId);

            log.info(" 경기 종료 처리 완료: matchId={}", matchId);
            log.info("ℹ 미확정 유저는 클라이언트에서 FailedStatsController API 호출 필요");

        } catch (Exception e) {
            log.error("Confirm 시점 경기 종료 처리 중 오류: matchId={}", matchId, e);
        }
    }

    /**
     * Redis 카운터에서 통계 계산 및 Match 엔티티 저장
     */
    private void saveMatchStatisticsFromRedis(Long matchId, Match match) {
        try {
            // human_rank_counter = 성공한 실제 유저 수
            String humanRankCounterKey = "match:" + matchId + ":human_rank_counter";
            String humanRankValue = redisTemplate.opsForValue().get(humanRankCounterKey);
            Integer successUserCount = (humanRankValue != null) ? Integer.parseInt(humanRankValue) : 0;

            // total_rank_counter = 성공한 전체 참가자 수 (유저 + 봇)
            String totalRankCounterKey = "match:" + matchId + ":total_rank_counter";
            String totalRankValue = redisTemplate.opsForValue().get(totalRankCounterKey);
            Integer totalSuccessCount = (totalRankValue != null) ? Integer.parseInt(totalRankValue) : 0;

            // success_bot_count = 전체 - 유저
            Integer successBotCount = totalSuccessCount - successUserCount;

            // Match 엔티티에 저장
            match.setSuccessUserCount(successUserCount);
            match.setSuccessBotCount(Math.max(0, successBotCount));  // 음수 방지

            log.info(" Redis 카운터로 경기 통계 계산: matchId={}, successUserCount={}, successBotCount={}, totalSuccess={}",
                    matchId, successUserCount, successBotCount, totalSuccessCount);

        } catch (Exception e) {
            log.error("Redis 카운터 통계 저장 중 오류: matchId={}", matchId, e);
            // 오류 시 0으로 설정
            match.setSuccessUserCount(0);
            match.setSuccessBotCount(0);
        }
    }
}