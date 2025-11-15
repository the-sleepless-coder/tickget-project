package com.ticketing.seat.service;

import com.ticketing.seat.dto.ConfirmedSeatDto;
import com.ticketing.seat.dto.SeatConfirmationRequest;
import com.ticketing.seat.dto.SeatConfirmationResponse;
import com.ticketing.entity.Match;
import com.ticketing.entity.UserStats;
import com.ticketing.seat.exception.MatchNotFoundException;
import com.ticketing.seat.redis.MatchStatusRepository;
import com.ticketing.seat.redis.SeatReservationRedisRepository;
import com.ticketing.repository.MatchRepository;
import com.ticketing.repository.UserStatsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeatConfirmationService {

    private final MatchRepository matchRepository;
    private final MatchStatusRepository matchStatusRepository;
    private final SeatReservationRedisRepository seatReservationRedisRepository;
    private final EventPublisherService eventPublisherService;
    private final UserStatsRepository userStatsRepository;
    private final StringRedisTemplate redisTemplate;
    private final MatchStatusSyncService matchStatusSyncService;
    private final RoomServerClient roomServerClient;

    @Transactional
    public SeatConfirmationResponse confirmSeats(Long matchId, SeatConfirmationRequest request) {
        long startTime = System.currentTimeMillis();

        if (request.getUserId() == null) {
            return buildErrorResponse("사용자 ID는 필수 입력 항목입니다.");
        }

        Long userId = request.getUserId();
        boolean isBot = userId < 0;  // 봇 여부 판단

        try {
            // 1. Match 조회 (DB 상태 체크 안 함! - playing이든 finished든 상관없이 진행)
            Match match = matchRepository.findById(matchId)
                    .orElseThrow(() -> new MatchNotFoundException(matchId));

            // 2. Redis에서 해당 유저가 선점한 좌석 조회 (Redis 상태 무관)
            List<String> seatIds = findUserSeats(matchId, userId);

            if (seatIds.isEmpty()) {
                SeatConfirmationResponse response = buildErrorResponse("선점된 좌석이 없습니다.");
                publishConfirmationEvent(userId, matchId, List.of(), null,
                        false, response.getMessage(), startTime);
                return response;
            }

            // 3. 좌석 정보 추출
            List<ConfirmedSeatDto> confirmedSeats = new ArrayList<>();
            List<String> sectionIds = new ArrayList<>();
            String selectedSection = "";
            String selectedSeat = "";

            for (String seatId : seatIds) {
                String sectionId = extractSection(seatId);
                confirmedSeats.add(ConfirmedSeatDto.builder()
                        .seatId(seatId)
                        .sectionId(sectionId)
                        .build());
                sectionIds.add(sectionId);

                // 첫 번째 좌석 정보 저장 (user_stats용)
                if (selectedSection.isEmpty()) {
                    selectedSection = sectionId;
                    selectedSeat = seatId;
                }
            }


            // confirmSeats() 메서드에서 userRank 조회 부분
            // ===== 등수는 Hold 시점에 이미 계산되었으므로 조회만 =====
            Integer userRank = isBot ? -1 : getUserRankFromRedis(matchId, userId);
            Integer totalRank = getTotalRankFromRedis(matchId, userId);  // 봇 포함 전체 등수
            // ===========================================================


            // 실제 유저 확정 카운트 증가 (Redis)
            if (!isBot) {
                String confirmedHumanCountKey = "match:" + matchId + ":confirmed_human_count";
                redisTemplate.opsForValue().increment(confirmedHumanCountKey);

                // TTL 설정 (10분)
                redisTemplate.expire(confirmedHumanCountKey, Duration.ofSeconds(600));
            }




            // userStats 빌더
            if (!isBot) {
                UserStats userStats = UserStats.builder()
                        .userId(userId)
                        .matchId(matchId)
                        .isSuccess(true)
                        .selectedSection(selectedSection)
                        .selectedSeat(selectedSeat)
                        .dateSelectTime(request.getDateSelectTime())
                        .dateMissCount(request.getDateMissCount() != null ? request.getDateMissCount() : 0)
                        .seccodeSelectTime(request.getSeccodeSelectTime())
                        .seccodeBackspaceCount(request.getSeccodeBackspaceCount() != null ? request.getSeccodeBackspaceCount() : 0)
                        .seccodeTryCount(request.getSeccodeTryCount() != null ? request.getSeccodeTryCount() : 0)
                        .seatSelectTime(request.getSeatSelectTime())
                        .seatSelectTryCount(request.getSeatSelectTryCount() != null ? request.getSeatSelectTryCount() : 0)
                        .seatSelectClickMissCount(request.getSeatSelectClickMissCount() != null ? request.getSeatSelectClickMissCount() : 0)
                        .userRank(userRank)
                        .totalRank(totalRank)  // ← 전체 등수 저장
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();

                userStatsRepository.save(userStats);
                log.info("실제 유저 통계 저장 완료: userId={}, matchId={}, userRank={}, totalRank={}",
                        userId, matchId, userRank, totalRank);
            } else {
                log.debug("봇은 통계 저장하지 않음: userId={}, matchId={}, totalRank={}",
                        userId, matchId, totalRank);
            }


            // ===== 추가: 실제 유저인 경우 humanusers 감소 =====
            Long remainingHumanUsers = null;
            if (!isBot) {
                String humanUsersKey = "humanusers:match:" + matchId;
                remainingHumanUsers = redisTemplate.opsForValue().decrement(humanUsersKey);
                log.info("실제 유저 Confirm: matchId={}, userId={}, 남은 실제 유저={}",
                        matchId, userId, remainingHumanUsers);
            }
            // ==================================================

            // 6. confirmed_count 증가 (좌석 수만큼)
            String confirmedCountKey = "match:" + matchId + ":confirmed_count";
            Long confirmedCount = redisTemplate.opsForValue().increment(confirmedCountKey, seatIds.size());

            // 7. reserved_count 조회 (좌석 수만큼)
            String reservedCountKey = "match:" + matchId + ":reserved_count";
            String reservedCountStr = redisTemplate.opsForValue().get(reservedCountKey);

            log.info("Confirm 후 상태: matchId={}, confirmed={}, reserved={}",
                    matchId, confirmedCount, reservedCountStr);

            // ===== 경기 종료 조건 변경 =====
            // 조건: humanusers == 0 (모든 실제 유저가 confirm 완료)
            if (remainingHumanUsers != null && remainingHumanUsers <= 0) {
                log.info("모든 실제 유저 Confirm 완료 - 경기 종료 처리: matchId={}, remainingHumanUsers={}",
                        matchId, remainingHumanUsers);

                saveMatchStatistics(matchId, match);
                // DB 상태를 FINISHED로 변경
                match.setStatus(Match.MatchStatus.FINISHED);
                match.setEndedAt(LocalDateTime.now());
                matchRepository.save(match);

                // Redis 전체 정리
                cleanupAllMatchRedis(matchId);

                // 룸 서버에 매치 종료 알림
                Long roomId = match.getRoomId();
                boolean notificationSuccess = roomServerClient.notifyMatchEnd(roomId);

                if (notificationSuccess) {
                    log.info("경기 자동 종료 및 룸 서버 알림 완료: matchId={}, roomId={}, status=FINISHED, endedAt={}",
                            matchId, roomId, match.getEndedAt());
                } else {
                    log.warn("경기는 종료되었으나 룸 서버 알림 실패: matchId={}, roomId={}", matchId, roomId);
                }
            } else {
                log.debug("아직 실제 유저 Confirm 대기 중 또는 봇만 확정: matchId={}, remainingHumanUsers={}",
                        matchId, remainingHumanUsers);
            }
            // =========================================


            // 9. 성공 응답 생성
            SeatConfirmationResponse response = SeatConfirmationResponse.builder()
                    .success(true)
                    .message("개인 경기 종료")
                    .userRank(userRank)
                    .confirmedSeats(confirmedSeats)
                    .matchId(matchId)
                    .userId(userId)
                    .build();

            // 8. 이벤트 발행
            publishConfirmationEvent(userId, matchId, seatIds, sectionIds,
                    true, "개인 경기 종료", startTime);

            return response;

        } catch (Exception e) {
            log.error("좌석 확정 중 오류 발생: {}", e.getMessage(), e);

            SeatConfirmationResponse response = buildErrorResponse("좌석 확정 처리 중 오류가 발생했습니다: " + e.getMessage());
            publishConfirmationEvent(userId, matchId, List.of(), null,
                    false, e.getMessage(), startTime);

            return response;
        }
    }

    /**
     * 경기 종료 시 통계 데이터 저장
     */
    private void saveMatchStatistics(Long matchId, Match match) {
        try {
            // 1. successUserCount - Redis에서 조회
            String confirmedHumanCountKey = "match:" + matchId + ":confirmed_human_count";
            String confirmedHumanCountStr = redisTemplate.opsForValue().get(confirmedHumanCountKey);
            Integer successUserCount = 0;
            if (confirmedHumanCountStr != null) {
                try {
                    successUserCount = Integer.parseInt(confirmedHumanCountStr);
                } catch (NumberFormatException e) {
                    log.warn("successUserCount 파싱 실패: matchId={}, value={}", matchId, confirmedHumanCountStr);
                }
            }

            // 2. successBotCount - 계산식 (total_rank_counter - human_rank_counter)
            String totalRankCounterKey = "match:" + matchId + ":total_rank_counter";
            String humanRankCounterKey = "match:" + matchId + ":human_rank_counter";

            String totalRankStr = redisTemplate.opsForValue().get(totalRankCounterKey);
            String humanRankStr = redisTemplate.opsForValue().get(humanRankCounterKey);

            Integer totalRank = 0;
            Integer humanRank = 0;

            if (totalRankStr != null) {

                try {
                    totalRank = Integer.parseInt(totalRankStr);
                } catch (NumberFormatException e) {
                    log.warn("totalRank 파싱 실패: matchId={}, value={}", matchId, totalRankStr);
                }
            }

            if (humanRankStr != null) {
                try {
                    humanRank = Integer.parseInt(humanRankStr);
                } catch (NumberFormatException e) {
                    log.warn("humanRank 파싱 실패: matchId={}, value={}", matchId, humanRankStr);
                }
            }

            Integer successBotCount = totalRank - humanRank;

            // 3. Match 엔티티에 저장
            match.setSuccessUserCount(successUserCount);
            match.setSuccessBotCount(successBotCount);

            log.info("경기 통계 저장: matchId={}, successUserCount={}, successBotCount={}, totalRank={}, humanRank={}",
                    matchId, successUserCount, successBotCount, totalRank, humanRank);

        } catch (Exception e) {
            log.error("경기 통계 저장 중 오류 발생: matchId={}", matchId, e);
        }
    }

    /**
     * SeatConfirmationService.java - getUserRankFromRedis, getTotalRankFromRedis, cleanupAllMatchRedis 메서드 수정
     *
     * 변경 사항:
     * - Hash에서 등수 조회
     * - Hash 키 삭제 (패턴 매칭 불필요)
     */

    /**
     * Hold 시점에 저장된 등수 조회 (Confirm 시점)
     * Hash에서 조회: match:{matchId}:user:rank
     */
    private Integer getUserRankFromRedis(Long matchId, Long userId) {
        String userRankHashKey = "match:" + matchId + ":user:rank";
        Object rankObj = redisTemplate.opsForHash().get(userRankHashKey, String.valueOf(userId));

        if (rankObj != null) {
            try {
                return Integer.parseInt(rankObj.toString());
            } catch (NumberFormatException e) {
                log.warn("등수 파싱 실패: userId={}, matchId={}, rankObj={}", userId, matchId, rankObj);
            }
        }

        return -1; // 등수 정보 없음 (봇이거나 Hold 실패)
    }

    /**
     * Hold 시점에 저장된 전체 등수 조회 (Confirm 시점)
     * Hash에서 조회: match:{matchId}:user:totalRank
     */
    private Integer getTotalRankFromRedis(Long matchId, Long userId) {
        String userTotalRankHashKey = "match:" + matchId + ":user:totalRank";
        Object totalRankObj = redisTemplate.opsForHash().get(userTotalRankHashKey, String.valueOf(userId));

        if (totalRankObj != null) {
            try {
                return Integer.parseInt(totalRankObj.toString());
            } catch (NumberFormatException e) {
                log.warn("전체 등수 파싱 실패: userId={}, matchId={}, totalRankObj={}",
                        userId, matchId, totalRankObj);
            }
        }

        return -1; // 등수 정보 없음
    }

    /**
     * Redis 전체 정리 (모든 키 삭제)
     * - 좌석 키: seat:{matchId}:*
     * - 상태 키: match:{matchId}:status
     * - 카운트 키: match:{matchId}:reserved_count, match:{matchId}:confirmed_count
     * - 실제 유저 키: humanusers:match:{matchId}
     * - 등수 카운터 키: match:{matchId}:human_rank_counter, match:{matchId}:total_rank_counter
     * - 유저 등수 Hash 키: match:{matchId}:user:rank, match:{matchId}:user:totalRank
     */
    private void cleanupAllMatchRedis(Long matchId) {
        log.info("경기 종료 - Redis 전체 정리 시작: matchId={}", matchId);

        try {
            // 1. 좌석 키 삭제
            String seatPattern = "seat:" + matchId + ":*";
            Set<String> seatKeys = redisTemplate.keys(seatPattern);
            if (seatKeys != null && !seatKeys.isEmpty()) {
                redisTemplate.delete(seatKeys);
                log.info("좌석 키 삭제: matchId={}, count={}", matchId, seatKeys.size());
            }

            // 2. 상태 키 삭제
            String statusKey = "match:" + matchId + ":status";
            redisTemplate.delete(statusKey);

            // 3. 카운트 키 삭제
            String countKey = "match:" + matchId + ":reserved_count";
            String confirmedCountKey = "match:" + matchId + ":confirmed_count";
            String confirmedHumanCountKey = "match:" + matchId + ":confirmed_human_count";
            redisTemplate.delete(countKey);
            redisTemplate.delete(confirmedCountKey);
            redisTemplate.delete(confirmedHumanCountKey);

            // 4. 실제 유저 카운터 키 삭제
            String humanUsersKey = "humanusers:match:" + matchId;
            redisTemplate.delete(humanUsersKey);

            // 5. 등수 카운터 키 삭제
            String humanRankCounterKey = "match:" + matchId + ":human_rank_counter";
            String totalRankCounterKey = "match:" + matchId + ":total_rank_counter";
            redisTemplate.delete(humanRankCounterKey);
            redisTemplate.delete(totalRankCounterKey);

            // 6. 유저 등수 Hash 키 삭제 (개별 키 패턴 매칭 불필요!)
            String userRankHashKey = "match:" + matchId + ":user:rank";
            String userTotalRankHashKey = "match:" + matchId + ":user:totalRank";

            Boolean deletedRankHash = redisTemplate.delete(userRankHashKey);
            Boolean deletedTotalRankHash = redisTemplate.delete(userTotalRankHashKey);

            log.info("유저 등수 Hash 키 삭제: matchId={}, rank={}, totalRank={}",
                    matchId, deletedRankHash, deletedTotalRankHash);

            log.info("유저 등수 Hash 키 삭제: matchId={}, rank={}, totalRank={}",
                    matchId, deletedRankHash, deletedTotalRankHash);

            log.info("경기 Redis 전체 정리 완료: matchId={}", matchId);

        } catch (Exception e) {
            log.error("경기 Redis 정리 중 오류 발생: matchId={}", matchId, e);
        }
    }


    /**
     * Redis에서 해당 유저가 선점한 좌석 조회
     * @return seatId 목록 (형식: "8-9-15")
     */
    private List<String> findUserSeats(Long matchId, Long userId) {
        List<String> userSeats = new ArrayList<>();

        String pattern = "seat:" + matchId + ":*";
        Set<String> keys = redisTemplate.keys(pattern);

        if (keys != null) {
            for (String key : keys) {
                String value = redisTemplate.opsForValue().get(key);
                if (value != null) {
                    String[] parts = value.split(":");
                    if (parts.length == 2) {
                        Long ownerId = Long.valueOf(parts[0]);
                        if (ownerId.equals(userId)) {
                            // key 형식: seat:100:8:9-15 -> seatId: 8-9-15
                            String seatId = extractSeatIdFromKey(key);
                            userSeats.add(seatId);
                        }
                    }
                }
            }
        }

        return userSeats;
    }

    /**
     * Redis 키에서 seatId 추출
     * 예: "seat:100:8:9-15" -> "8-9-15"
     */
    private String extractSeatIdFromKey(String key) {
        String[] parts = key.split(":");
        if (parts.length >= 4) {
            return parts[2] + "-" + parts[3];  // sectionId-row-col
        }
        return "";
    }


    /**
     * seatId에서 sectionId 추출
     * 예: "8-9-15" -> "8"
     */
    private String extractSection(String seatId) {
        String[] parts = seatId.split("-");
        return parts.length >= 1 ? parts[0] : "";
    }

    private void publishConfirmationEvent(
            Long userId,
            Long matchId,
            List<String> seatIds,
            List<String> sectionIds,
            boolean success,
            String message,
            long startTime) {

        long duration = System.currentTimeMillis() - startTime;

        eventPublisherService.publishSeatConfirmationEvent(
                userId,
                matchId,
                seatIds,
                sectionIds,
                success,
                message,
                duration);
    }

    private SeatConfirmationResponse buildErrorResponse(String message) {
        return SeatConfirmationResponse.builder()
                .success(false)
                .message(message)
                .build();
    }
}