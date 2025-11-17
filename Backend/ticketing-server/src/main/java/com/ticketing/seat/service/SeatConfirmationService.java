package com.ticketing.seat.service;

import com.ticketing.seat.dto.ConfirmedSeatDto;
import com.ticketing.seat.dto.SeatConfirmationRequest;
import com.ticketing.seat.dto.SeatConfirmationResponse;
import com.ticketing.entity.Match;
import com.ticketing.entity.UserStats;
import com.ticketing.seat.exception.MatchNotFoundException;
import com.ticketing.seat.redis.MatchStatusRepository;
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
     * - UserStats 저장 (봇도 통계에 포함)
     * - total_rank_counter 증가
     * - confirmed_count 증가 (좌석 수만큼)
     */
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

        // 2. total_rank_counter 증가 (봇도 전체 등수에 포함)
        String totalRankCounterKey = "match:" + matchId + ":total_rank_counter";
        Long totalRankLong = redisTemplate.opsForValue().increment(totalRankCounterKey);
        Integer totalRank = (totalRankLong != null) ? totalRankLong.intValue() : null;

        // 3. confirmed_count 증가 (좌석 수만큼)
        String confirmedCountKey = "match:" + matchId + ":confirmed_count";
        Long confirmedCount = redisTemplate.opsForValue().increment(confirmedCountKey, seatCount);

        log.info("봇 Confirm 완료: matchId={}, botId={}, totalRank={}, confirmedCount={}, seatCount={}",
                matchId, userId, totalRank, confirmedCount, seatCount);

        // 4. 성공 응답
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
     * - UserStats 저장 (통계 데이터 포함)
     * - Confirm 시점에 등수 계산
     * - humanusers 감소
     * - 경기 종료 체크
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

        // ===== Confirm 시점에 등수 계산 =====

        // 4. human_rank_counter 증가 → userRank
        String humanRankCounterKey = "match:" + matchId + ":human_rank_counter";
        Long userRankLong = redisTemplate.opsForValue().increment(humanRankCounterKey);
        Integer userRank = userRankLong.intValue();

        // 5. total_rank_counter 증가 → totalRank
        String totalRankCounterKey = "match:" + matchId + ":total_rank_counter";
        Long totalRankLong = redisTemplate.opsForValue().increment(totalRankCounterKey);
        Integer totalRank = totalRankLong.intValue();

        log.info("Confirm 시점 등수 계산: matchId={}, userId={}, userRank={}, totalRank={}",
                matchId, userId, userRank, totalRank);

        // 6. confirmed_count 증가 (좌석 수만큼)
        String confirmedCountKey = "match:" + matchId + ":confirmed_count";
        Long confirmedCount = redisTemplate.opsForValue().increment(confirmedCountKey, seatIds.size());

        // 7. confirmed_human_count 증가
        String confirmedHumanCountKey = "match:" + matchId + ":confirmed_human_count";
        redisTemplate.opsForValue().increment(confirmedHumanCountKey);
        redisTemplate.expire(confirmedHumanCountKey, Duration.ofSeconds(600));

        // 8. UserStats 저장 (좌석 정보를 콤마로 연결하여 1개 레코드로 저장)
        String selectedSections = String.join(",", allSectionIds);  // 예: "A,A" 또는 "A,B"
        String selectedSeats = String.join(",", allSeatIds);       // 예: "seat:1:A:5,seat:1:A:6"

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
                .userRank(userRank)
                .totalRank(totalRank)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        userStatsRepository.save(userStats);
        log.info("유저 통계 저장 완료: userId={}, matchId={}, 좌석수={}, selectedSeats={}, userRank={}, totalRank={}",
                userId, matchId, allSeatIds.size(), selectedSeats, userRank, totalRank);

        // 9. humanusers 감소
        String humanUsersKey = "humanusers:match:" + matchId;
        Long remainingHumanUsers = redisTemplate.opsForValue().decrement(humanUsersKey);
        log.info("실제 유저 Confirm: matchId={}, userId={}, 남은 실제 유저={}",
                matchId, userId, remainingHumanUsers);

        // 10. 경기 종료 조건 체크
        // 조건: humanusers == 0 (모든 실제 유저가 confirm 완료)
        // 단, 이미 FINISHED 상태면 중복 처리 방지
        if (remainingHumanUsers != null && remainingHumanUsers <= 0
                && match.getStatus() == Match.MatchStatus.PLAYING) {
            log.info("모든 실제 유저 Confirm 완료 - 경기 종료 처리: matchId={}, remainingHumanUsers={}",
                    matchId, remainingHumanUsers);

            saveMatchStatistics(matchId, match);
            // DB 상태를 FINISHED로 변경
            match.setStatus(Match.MatchStatus.FINISHED);
            match.setEndedAt(LocalDateTime.now());
            matchRepository.save(match);

            // Redis 전체 정리
            cleanupAllMatchRedis(matchId);

            // Stats 서버에 매치 종료 알림
            boolean statsNotificationSuccess = statsServerClient.notifyMatchEnd(matchId);
            if (statsNotificationSuccess) {
                log.info("Stats 서버 매치 종료 알림 성공: matchId={}", matchId);
            } else {
                log.warn("Stats 서버 매치 종료 알림 실패: matchId={}", matchId);
            }

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
            log.debug("아직 실제 유저 Confirm 대기 중: matchId={}, remainingHumanUsers={}",
                    matchId, remainingHumanUsers);
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
     * Redis 전체 정리 (모든 키 삭제)
     * - 좌석 키: seat:{matchId}:*
     * - 상태 키: match:{matchId}:status
     * - 카운트 키: match:{matchId}:reserved_count, confirmed_count, confirmed_human_count
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

            // 3. 카운트 키 삭제
            String reservedCountKey = "match:" + matchId + ":reserved_count";
            String confirmedCountKey = "match:" + matchId + ":confirmed_count";
            String confirmedHumanCountKey = "match:" + matchId + ":confirmed_human_count";
            redisTemplate.delete(reservedCountKey);
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