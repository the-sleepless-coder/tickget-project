package com.ticketing.seat.service;

import com.ticketing.entity.Match;
import com.ticketing.entity.UserStats;
import com.ticketing.repository.MatchRepository;
import com.ticketing.repository.UserStatsRepository;
import com.ticketing.seat.dto.ConfirmedSeatDto;
import com.ticketing.seat.dto.SeatConfirmationRequest;
import com.ticketing.seat.dto.SeatConfirmationResponse;
import com.ticketing.seat.exception.MatchNotFoundException;
import com.ticketing.seat.redis.MatchStatusRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeatConfirmationServiceBackup {
    private final MatchRepository matchRepository;
    private final MatchStatusRepository matchStatusRepository;
    private final EventPublisherService eventPublisherService;
    private final UserStatsRepository userStatsRepository;
    private final StringRedisTemplate redisTemplate;
    private final RoomServerClient roomServerClient;
    private final StatsServerClient statsServerClient;

    @Transactional
    public SeatConfirmationResponse confirmSeats(Long matchId, SeatConfirmationRequest request) {
        long startTime = System.currentTimeMillis();

        if (request.getUserId() == null) {
            return buildErrorResponse("사용자 ID는 필수 입력 항목입니다.");
        }

        Long userId = request.getUserId();
        boolean isBot = userId < 0;  // 봇 여부 판단

        try {
            // 1. Match 조회
            Match match = matchRepository.findById(matchId)
                    .orElseThrow(() -> new MatchNotFoundException(matchId));

            // DB 상태가 WAITING일 때만 차단 (PLAYING, FINISHED 모두 허용)
            if (match.getStatus() == Match.MatchStatus.WAITING) {
                return buildErrorResponse("경기가 아직 시작되지 않았습니다.");
            }

            // ===== 봇과 실제 유저 분기 처리 =====
            if (isBot) {
                // ========== 봇 Confirm 처리 ==========
                return handleBotConfirm(matchId, userId, match, startTime);
            } else {
                // ========== 실제 유저 Confirm 처리 ==========
                return handleUserConfirm(matchId, request, match, startTime);
            }

        } catch (Exception e) {
            log.error("좌석 확정 중 오류 발생: {}", e.getMessage(), e);

            SeatConfirmationResponse response = buildErrorResponse("좌석 확정 처리 중 오류가 발생했습니다: " + e.getMessage());
            publishConfirmationEvent(userId, matchId, List.of(), null,
                    false, e.getMessage(), startTime);

            return response;
        }
    }

    /**
     * 봇 Confirm 처리
     * - 좌석 키 조회 필요 (좌석 수 확인용)
     * - reserved_count 증가 (좌석 수만큼)
     * - total_rank_counter 증가
     * - success_bot_count 증가
     * - humanusers 변경 없음
     * - user_stats 저장 안 함
     */
    private static final int EXPIRE_TIME = 1800;
    private SeatConfirmationResponse handleBotConfirm(Long matchId, Long userId,
                                                      Match match, long startTime) {
        log.info("봇 Confirm 처리 시작: matchId={}, botId={}", matchId, userId);

        // 1. Redis에서 봇이 선점한 좌석 조회
        List<String> seatIds = findUserSeats(matchId, userId);

        if (seatIds.isEmpty()) {
            log.warn("봇의 선점 좌석 없음: matchId={}, botId={}", matchId, userId);
            return buildErrorResponse("선점된 좌석이 없습니다.");
        }

        int seatCount = seatIds.size();

        // 2. 방 내 등수 관리
        String matchRankKey = "match:%s:rank".formatted(matchId);
        ZSetOperations<String, String> zset = redisTemplate.opsForZSet();
        double now = (double) System.currentTimeMillis();
        String userIdString = String.valueOf(userId);
        zset.add(matchRankKey, userIdString, now);
        redisTemplate.expire(matchRankKey, Duration.ofSeconds(EXPIRE_TIME));

        // 3. reserved_count 증가 (좌석 수만큼)
        String reservedCountKey = "match:" + matchId + ":reserved_count";
        Long reservedCount = redisTemplate.opsForValue().increment(reservedCountKey, seatCount);
        redisTemplate.expire(reservedCountKey, Duration.ofSeconds(600));

        // 4. total_rank_counter 증가 (봇도 전체 등수에 포함)
        String totalRankCounterKey = "match:" + matchId + ":total_rank_counter";
        Long totalRankLong = redisTemplate.opsForValue().increment(totalRankCounterKey);
        redisTemplate.expire(totalRankCounterKey, Duration.ofSeconds(600));
        Integer totalRank = (totalRankLong != null) ? totalRankLong.intValue() : null;

        // 5. success_bot_count 증가 (Match 엔티티)
        if (match.getSuccessBotCount() == null) {
            match.setSuccessBotCount(0);
        }
        // match.setSuccessBotCount(match.getSuccessBotCount() + 1);
        // matchRepository.save(match);

        log.info("봇 Confirm 완료: matchId={}, botId={}, totalRank={}, reservedCount={}, seatCount={}",
                matchId, userId, totalRank, reservedCount, seatCount);

        // 6. 만석 체크 (봇 Confirm 후에도 만석 가능)
        Long roomId = match.getRoomId();
        Integer totalSeats = roomServerClient.getTotalSeats(roomId);

        if (totalSeats != null && reservedCount != null && reservedCount >= totalSeats) {
            log.info("봇 Confirm으로 만석 도달: matchId={}, reservedCount={}, totalSeats={}",
                    matchId, reservedCount, totalSeats);

            if (match.getStatus() == Match.MatchStatus.PLAYING) {
                handleFullMatchAtConfirm(matchId, match);
            }
        }

        // 6. 성공 응답
        return SeatConfirmationResponse.builder()
                .success(true)
                .message("봇 확정 완료")
                .userRank(-1)  // 봇은 응답에서는 userRank 없음으로 표기
                .matchId(matchId)
                .userId(userId)
                .build();
    }

    /**
     * 실제 유저 Confirm 처리
     * - 좌석 키 조회 (없으면 실패)
     * - reserved_count 증가 (좌석 수만큼)
     * - UserStats 저장 (통계 데이터 포함)
     * - Confirm 시점에 등수 계산
     * - humanusers 감소
     * - 만석 또는 모든 실제 유저 Confirm 시 경기 종료
     */
    private SeatConfirmationResponse handleUserConfirm(Long matchId,
                                                       SeatConfirmationRequest request,
                                                       Match match, long startTime) {
        Long userId = request.getUserId();

        // 1. 중복 Confirm 체크 (DB)
        boolean alreadyConfirmed = !userStatsRepository
                .findByMatchIdAndUserId(matchId, userId)
                .isEmpty();

        if (alreadyConfirmed) {
            SeatConfirmationResponse response = buildErrorResponse("이미 확정된 좌석입니다.");
            publishConfirmationEvent(userId, matchId, List.of(), null,
                    false, response.getMessage(), startTime);
            return response;
        }

        // 2. Redis에서 해당 유저가 선점한 좌석 조회
        List<String> seatIds = findUserSeats(matchId, userId);

        if (seatIds.isEmpty()) {
            SeatConfirmationResponse response = buildErrorResponse("선점된 좌석이 없습니다.");
            publishConfirmationEvent(userId, matchId, List.of(), null,
                    false, response.getMessage(), startTime);
            return response;
        }

        // 3. 좌석 정보 추출 및 리스트에 모으기
        List<ConfirmedSeatDto> confirmedSeats = new ArrayList<>();
        List<String> sectionIds = new ArrayList<>();
        List<String> allSectionIds = new ArrayList<>();  // 모든 sectionId 수집
        List<String> allSeatIds = new ArrayList<>();     // 모든 seatId 수집

        for (String seatId : seatIds) {
            String sectionId = extractSection(seatId);

            // ConfirmedSeat 리스트에 추가
            confirmedSeats.add(ConfirmedSeatDto.builder()
                    .seatId(seatId)
                    .sectionId(sectionId)
                    .build());
            sectionIds.add(sectionId);

            // UserStats용 정보 수집
            allSectionIds.add(sectionId);
            allSeatIds.add(seatId);
        }

        int seatCount = seatIds.size();

        // 3.user 등수 기록.
        String matchRankKey = "match:%s:rank".formatted(matchId);
        ZSetOperations<String, String> zset = redisTemplate.opsForZSet();
        double now = (double) System.currentTimeMillis();
        String userIdString = String.valueOf(userId);
        zset.add(matchRankKey, userIdString, now);
        redisTemplate.expire(matchRankKey, Duration.ofSeconds(EXPIRE_TIME));

        // 4. reserved_count 증가 (좌석 수만큼)
        String reservedCountKey = "match:" + matchId + ":reserved_count";
        Long reservedCount = redisTemplate.opsForValue().increment(reservedCountKey, seatCount);
        redisTemplate.expire(reservedCountKey, Duration.ofSeconds(600));

        // ===== Confirm 시점에 등수 계산 =====

        // 5. human_rank_counter 증가 → userRank
        String humanRankCounterKey = "match:" + matchId + ":human_rank_counter";
        Long userRankLong = redisTemplate.opsForValue().increment(humanRankCounterKey);
        redisTemplate.expire(humanRankCounterKey, Duration.ofSeconds(600));
        Integer userRank = userRankLong.intValue();

        // 6. total_rank_counter 증가 → totalRank
        String totalRankCounterKey = "match:" + matchId + ":total_rank_counter";
        Long totalRankLong = redisTemplate.opsForValue().increment(totalRankCounterKey);
        redisTemplate.expire(totalRankCounterKey, Duration.ofSeconds(600));
        Integer totalRank = totalRankLong.intValue();

        log.info("Confirm 시점 등수 계산: matchId={}, userId={}, userRank={}, totalRank={}",
                matchId, userId, userRank, totalRank);

        // 7. humanusers 감소
        String humanUsersKey = "humanusers:match:" + matchId;
        Long remainingHumanUsers = redisTemplate.opsForValue().decrement(humanUsersKey);
        redisTemplate.expire(humanUsersKey, Duration.ofSeconds(600));
        log.info("실제 유저 Confirm: matchId={}, userId={}, 남은 실제 유저={}",
                matchId, userId, remainingHumanUsers);

        // 8. success_user_count 증가 (Match 엔티티)
        if (match.getSuccessUserCount() == null) {
            match.setSuccessUserCount(0);
        }
        // match.setSuccessUserCount(match.getSuccessUserCount() + 1);
        // matchRepository.save(match);

        // 9. UserStats 저장 (좌석 정보를 콤마로 연결하여 1개 레코드로 저장)
        String selectedSections = String.join(",", allSectionIds);  // 예: "8,8" 또는 "8,9"
        String selectedSeats = String.join(",", allSeatIds);        // 예: "8-9-15,8-9-16"

        UserStats userStats = UserStats.builder()
                .userId(userId)
                .matchId(matchId)
                .isSuccess(true)
                .selectedSection(selectedSections)  // 모든 섹션 ID (콤마 구분)
                .selectedSeat(selectedSeats)        // 모든 좌석 ID (콤마 구분)
                .dateSelectTime(request.getDateSelectTime())
                .dateMissCount(request.getDateMissCount() != null ? request.getDateMissCount() : 0)
                .seccodeSelectTime(request.getSeccodeSelectTime())
                .seccodeBackspaceCount(request.getSeccodeBackspaceCount() != null ? request.getSeccodeBackspaceCount() : 0)
                .seccodeTryCount(request.getSeccodeTryCount() != null ? request.getSeccodeTryCount() : 0)
                .seatSelectTime(request.getSeatSelectTime())
                .seatSelectTryCount(request.getSeatSelectTryCount() != null ? request.getSeatSelectTryCount() : 0)
                .seatSelectClickMissCount(request.getSeatSelectClickMissCount() != null ? request.getSeatSelectClickMissCount() : 0)
                .userRank(-1)
                .totalRank(-1)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        userStatsRepository.save(userStats);
        log.info("유저 통계 저장 완료: userId={}, matchId={}, 좌석수={}, selectedSeats={}, userRank={}, totalRank={}",
                userId, matchId, allSeatIds.size(), selectedSeats, userRank, totalRank);

        // 10. 경기 종료 조건 체크
        // 조건 1: 모든 실제 유저 confirm 완료 (remainingHumanUsers <= 0)
        // 조건 2: 만석(reservedCount >= totalSeats)
        Long roomId = match.getRoomId();
        Integer totalSeats = roomServerClient.getTotalSeats(roomId);
        boolean isFull = reservedCount != null && totalSeats != null && reservedCount >= totalSeats;

        if ((remainingHumanUsers != null && remainingHumanUsers <= 0 || isFull)
            && match.getStatus() == Match.MatchStatus.PLAYING) {

            log.info("경기 종료 조건 만족 (모든 유저 확정 또는 만석): matchId={}, remainingHumanUsers={}, reservedCount={}, totalSeats={}",
                    matchId, remainingHumanUsers, reservedCount, totalSeats);

            handleFullMatchAtConfirm(matchId, match);
        } else {
            log.debug("아직 경기 계속 진행: matchId={}, remainingHumanUsers={}, reservedCount={}, totalSeats={}",
                    matchId, remainingHumanUsers, reservedCount, totalSeats);
        }

        // 11. 성공 응답 생성
        SeatConfirmationResponse response = SeatConfirmationResponse.builder()
                .success(true)
                .message("개인 경기 종료")
                .userRank(userRank)
                .confirmedSeats(confirmedSeats)
                .matchId(matchId)
                .userId(userId)
                .build();

        // 12. 이벤트 발행
        publishConfirmationEvent(userId, matchId, seatIds, sectionIds,
                true, "개인 경기 종료", startTime);

        return response;
    }

    /**
     * Confirm 시점에서 만석 또는 모든 유저 Confirm으로 경기 종료 처리
     */
    private void handleFullMatchAtConfirm(Long matchId, Match match) {
        try {
            //미확정 유저 실패 통계 저장 (매치 종료 전)
            saveFailedStatsForUnconfirmedUsers(matchId);
            // 1. MatchData 통계 수집
            // successUserCount, successBotCount 저장.
            saveMatchStatistics(matchId, match);

            // 그외 match 데이터 설정.
            match.setStatus(Match.MatchStatus.FINISHED);
            match.setEndedAt(LocalDateTime.now());
            matchRepository.save(match);

            // 2. DB 상태 변경
            // userStats 값 변경.
            // LinkedHashSet 반환.
            String matchKey = "match:%s:rank".formatted(matchId);
            ZSetOperations<String, String> zset = redisTemplate.opsForZSet();
            Set<String> members = zset.range(matchKey, 0, -1);

            // 각 멤버에 대한 userRank, totRank 기록
            int humanOnlyRank = 0;
            for(String member : members){
                long userIdLong = Long.parseLong(member);
                UserStats foundUserStats = userStatsRepository.findByMatchIdAndUserId(userIdLong, matchId).get(0);

                // 각 멤버에 대한 rank를 구한다.
                // Bot포함한 전체 Rank를 구한다.
                Long rawTotRank = zset.rank(matchKey, member);
                int totRank = (rawTotRank != null) ? rawTotRank.intValue() + 1 : -1;

                if(userIdLong > 0){
                    humanOnlyRank++;
                }

                foundUserStats.setUserRank(humanOnlyRank);
                foundUserStats.setTotalRank(totRank);

                userStatsRepository.save(foundUserStats);
            }

            // 3. Redis 상태를 CLOSED로 설정
            String statusKey = "match:" + matchId + ":status";
            redisTemplate.opsForValue().set(statusKey, "CLOSED");
            redisTemplate.expire(statusKey, Duration.ofSeconds(600));

            // 4. Redis 정리
            cleanupAllMatchRedis(matchId);

            // 5. 외부 서버 알림
            statsServerClient.notifyMatchEnd(matchId);
            roomServerClient.notifyMatchEnd(match.getRoomId());

            log.info(" 경기 종료 처리 완료: matchId={}", matchId);
            log.info("ℹ 미확정 유저는 클라이언트에서 FailedStatsController API 호출 필요");

        } catch (Exception e) {
            log.error("Confirm 시점 경기 종료 처리 중 오류: matchId={}", matchId, e);
        }
    }


    /**
     * 매치 종료 시 아직 confirm하지 못한 유저들의 실패 통계 저장
     */
    private void saveFailedStatsForUnconfirmedUsers(Long matchId) {
        try {
            // Redis에서 humanusers 확인
            String humanUsersKey = "humanusers:match:" + matchId;
            String remainingStr = redisTemplate.opsForValue().get(humanUsersKey);

            if (remainingStr != null) {
                int remaining = Integer.parseInt(remainingStr);

                if (remaining > 0) {
                    log.info("미확정 유저 {}명 실패 통계 저장 시작: matchId={}", remaining, matchId);

                    // Redis에서 Hold만 하고 Confirm 안 한 유저 찾기
                    Set<String> seatKeys = redisTemplate.keys("seat:" + matchId + ":*");
                    Set<Long> unconfirmedUsers = new HashSet<>();

                    if (seatKeys != null) {
                        for (String key : seatKeys) {
                            String value = redisTemplate.opsForValue().get(key);
                            if (value != null) {
                                String[] parts = value.split(":");
                                Long userId = Long.valueOf(parts[0]);

                                // 봇이 아니고 DB에 통계 없으면 미확정 유저
                                if (userId > 0 && !userStatsRepository.existsByUserIdAndMatchId(userId, matchId)) {
                                    unconfirmedUsers.add(userId);
                                }
                            }
                        }
                    }

                    // 각 미확정 유저의 실패 통계 저장
                    for (Long userId : unconfirmedUsers) {
                        UserStats failedStats = UserStats.builder()
                                .userId(userId)
                                .matchId(matchId)
                                .isSuccess(false)
                                .selectedSection("")
                                .selectedSeat("")
                                .dateSelectTime(0f)
                                .dateMissCount(0)
                                .seccodeSelectTime(0f)
                                .seccodeBackspaceCount(0)
                                .seccodeTryCount(0)
                                .seatSelectTime(0f)
                                .seatSelectTryCount(0)
                                .seatSelectClickMissCount(0)
                                .userRank(-1)
                                .totalRank(-1)
                                .createdAt(LocalDateTime.now())
                                .updatedAt(LocalDateTime.now())
                                .build();

                        userStatsRepository.save(failedStats);
                    }

                    log.info("미확정 유저 {}명 실패 통계 저장 완료: matchId={}", unconfirmedUsers.size(), matchId);
                }
            }
        } catch (Exception e) {
            log.error("미확정 유저 실패 통계 저장 중 오류: matchId={}", matchId, e);
        }
    }

    /**
     * 경기 종료 시 통계 데이터 저장
     */
    private Map<String, Integer> saveMatchStatistics(Long matchId, Match match) {
        try {
            // success_user_count, success_bot_count는 이미 Confirm 시점에 증가시킴
            // 여기서는 Redis에서 최종 값 확인만
            Match foundMatch = matchRepository.findById(matchId).orElseThrow(() -> new IllegalArgumentException("Match not found: " + matchId));;

            String matchKey = "match:%s:rank".formatted(matchId);
            ZSetOperations<String, String> zset = redisTemplate.opsForZSet();
            Set<String> members = zset.range(matchKey, 0, -1);

            int userSuccessCount= 0;
            int botSuccessCount = 0;
            for(String member: members){
                Long userIdLong = Long.valueOf(member);
                if(userIdLong > 0){
                    userSuccessCount++;
                }else if(userIdLong < 0){
                    botSuccessCount++;
                }
            }

            foundMatch.setSuccessUserCount(userSuccessCount);
            foundMatch.setSuccessBotCount(botSuccessCount);
            matchRepository.save(foundMatch);

            Map<String, Integer> result = new HashMap<>();
            result.put("userSuccessCount", userSuccessCount);
            result.put("botSuccessCount", botSuccessCount);

            log.info("경기 통계 저장: matchId={}, successUserCount={}, successBotCount={}",
                    matchId, match.getSuccessUserCount(), match.getSuccessBotCount());
            return result;

        } catch (Exception e) {
            log.error("경기 통계 저장 중 오류 발생: matchId={}", matchId, e);
        }

        return Collections.emptyMap();
    }

    /**
     * Redis 전체 정리 (모든 키 삭제)
     * - 좌석 키: seat:{matchId}:*
     * - 상태 키: match:{matchId}:status
     * - 카운트 키: match:{matchId}:reserved_count
     * - 실제 유저 키: humanusers:match:{matchId}
     * - 등수 카운터 키: match:{matchId}:human_rank_counter, total_rank_counter
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

            // 3. reserved_count 키 삭제
            String reservedCountKey = "match:" + matchId + ":reserved_count";
            redisTemplate.delete(reservedCountKey);

            // 4. 실제 유저 카운터 키 삭제
            String humanUsersKey = "humanusers:match:" + matchId;
            redisTemplate.delete(humanUsersKey);

            // 5. 등수 카운터 키 삭제
            String humanRankCounterKey = "match:" + matchId + ":human_rank_counter";
            String totalRankCounterKey = "match:" + matchId + ":total_rank_counter";
            redisTemplate.delete(humanRankCounterKey);
            redisTemplate.delete(totalRankCounterKey);

            log.info("경기 종료 - Redis 전체 정리 완료: matchId={}", matchId);

        } catch (Exception e) {
            log.error("Redis 정리 중 오류 발생: matchId={}", matchId, e);
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