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

    @Transactional
    public SeatConfirmationResponse confirmSeats(Long matchId, SeatConfirmationRequest request) {
        Long startTime = System.currentTimeMillis();

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

            // 4. 등수 계산 (실제 유저만, 봇 제외)
            Integer userRank = calculateUserRank(matchId, userId, isBot);

            // 5. user_stats 저장
            UserStats userStats;
            if (isBot) {
                // 봇이면 통계 데이터 모두 0으로
                userStats = UserStats.builder()
                        .userId(userId)
                        .matchId(matchId)
                        .isSuccess(true)
                        .selectedSection(selectedSection)
                        .selectedSeat(selectedSeat)
                        .dateSelectTime(0)
                        .dateMissCount(0)
                        .seccodeSelectTime(0)
                        .seccodeBackspaceCount(0)
                        .seccodeTryCount(0)
                        .seatSelectTime(0)
                        .seatSelectTryCount(0)
                        .seatSelectClickMissCount(0)
                        .userRank(-1)  // 봇은 등수 없음
                        .totalRank(-1)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();
            } else {
                // 실제 유저는 정상 저장
                userStats = UserStats.builder()
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
                        .totalRank(-1)  // 전체 경기 종료 후 계산
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();
            }

            userStatsRepository.save(userStats);

            // 6. 모든 유저(봇 포함) Confirm 완료 체크 및 경기 종료 처리
            checkAndFinishMatch(match, matchId);

            // 7. 성공 응답 생성
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
     * ✅ 경기 종료 조건 확인 및 처리
     * 모든 유저(봇 포함)가 Confirm 완료했는지 확인
     */
    private void checkAndFinishMatch(Match match, Long matchId) {
        // Redis의 reserved_count와 user_stats 개수 비교
        String countKey = "match:" + matchId + ":reserved_count";
        String countStr = redisTemplate.opsForValue().get(countKey);

        if (countStr != null) {
            int reservedCount = Integer.parseInt(countStr);
            long confirmedCount = userStatsRepository.findByMatchId(matchId).size();

            log.info("경기 종료 체크: matchId={}, reserved={}, confirmed={}",
                    matchId, reservedCount, confirmedCount);

            // 모든 선점 좌석이 확정되었으면 경기 종료 (봇 포함)
            if (confirmedCount >= reservedCount) {
                log.info("모든 유저(봇 포함) Confirm 완료 - 경기 종료 처리: matchId={}", matchId);

                // DB 상태를 FINISHED로 변경
                match.setStatus(Match.MatchStatus.FINISHED);
                match.setEndedAt(LocalDateTime.now());
                matchRepository.save(match);

                // Redis 전체 정리
                cleanupAllMatchRedis(matchId);

                log.info("경기 자동 종료 완료: matchId={}, status=FINISHED, endedAt={}",
                        matchId, match.getEndedAt());
            }
        } else {
            // reserved_count가 없는 경우 대체 로직
            log.warn("reserved_count 없음, Redis 좌석 키 기준으로 경기 종료 체크: matchId={}", matchId);

            Set<String> seatKeys = redisTemplate.keys("seat:" + matchId + ":*");
            int seatCount = (seatKeys != null) ? seatKeys.size() : 0;
            long confirmedCount = userStatsRepository.findByMatchId(matchId).size();

            // 좌석 키가 없거나, 확정 수가 maxUser 이상이면 종료
            if (seatCount > 0 && confirmedCount >= seatCount) {
                match.setStatus(Match.MatchStatus.FINISHED);
                match.setEndedAt(LocalDateTime.now());
                matchRepository.save(match);

                cleanupAllMatchRedis(matchId);

                log.info("경기 종료 (대체 로직): matchId={}, confirmed={}", matchId, confirmedCount);
            }
        }
    }

    /**
     * Redis 전체 정리 (모든 키 삭제)
     * - 좌석 키: seat:{matchId}:*
     * - 상태 키: match:{matchId}:status
     * - 카운트 키: match:{matchId}:reserved_count
     * - 실제 유저 키: humanusers:match:{matchId}, humanusers:match:{matchId}:initial
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
            redisTemplate.delete(countKey);

            // 4. 실제 유저 카운터 키 삭제
            String humanUsersKey = "humanusers:match:" + matchId;
            String humanUsersInitialKey = "humanusers:match:" + matchId + ":initial";
            redisTemplate.delete(humanUsersKey);
            redisTemplate.delete(humanUsersInitialKey);

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
     * 등수 계산 (실제 유저만, 봇 제외)
     */
    private Integer calculateUserRank(Long matchId, Long userId, boolean isBot) {
        // 봇이면 등수 계산 안 함
        if (isBot) {
            return -1;
        }

        // 실제 유저만 humanusers 카운터 감소
        String humanUsersKey = "humanusers:match:" + matchId;
        Long remainingUsers = redisTemplate.opsForValue().decrement(humanUsersKey);

        if (remainingUsers != null && remainingUsers >= 0) {
            // 등수 = (초기값 - 남은 유저 수)
            String initialCountKey = "humanusers:match:" + matchId + ":initial";
            String initialCountStr = redisTemplate.opsForValue().get(initialCountKey);

            if (initialCountStr != null) {
                int initialCount = Integer.parseInt(initialCountStr);
                int rank = initialCount - remainingUsers.intValue();
                log.info("유저 등수 계산: userId={}, rank={}, remaining={}", userId, rank, remainingUsers);
                return rank;
            }
        }

        log.warn("등수 계산 실패: userId={}, matchId={}", userId, matchId);
        return -1;
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