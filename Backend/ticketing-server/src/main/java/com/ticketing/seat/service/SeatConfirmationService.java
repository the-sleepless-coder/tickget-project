package com.ticketing.seat.service;

import com.ticketing.seat.dto.ConfirmedSeatDto;
import com.ticketing.seat.dto.SeatConfirmationRequest;
import com.ticketing.seat.dto.SeatConfirmationResponse;
import com.ticketing.seat.entity.Match;
import com.ticketing.seat.entity.UserStats;
import com.ticketing.seat.exception.MatchNotFoundException;
import com.ticketing.seat.redis.MatchStatusRepository;
import com.ticketing.seat.redis.SeatReservationRedisRepository;
import com.ticketing.seat.repository.MatchRepository;
import com.ticketing.seat.repository.UserStatsRepository;
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

    @Transactional
    public SeatConfirmationResponse confirmSeats(Long matchId, SeatConfirmationRequest request) {
        long startTime = System.currentTimeMillis();

        if (request.getUserId() == null) {
            return buildErrorResponse("사용자 ID는 필수 입력 항목입니다.");
        }

        Long userId = request.getUserId();

        try {
            // 1. Match 조회
            Match match = matchRepository.findById(matchId)
                    .orElseThrow(() -> new MatchNotFoundException(matchId));

            if (match.getStatus() != Match.MatchStatus.PLAYING) {
                SeatConfirmationResponse response = buildClosedResponse(matchId, userId.toString());
                publishConfirmationEvent(userId, matchId, List.of(), null,
                        false, response.getMessage(), startTime);
                return response;
            }

            String redisStatus = matchStatusRepository.getMatchStatus(matchId);
            if (!"OPEN".equalsIgnoreCase(redisStatus)) {
                SeatConfirmationResponse response = buildClosedResponse(matchId, userId.toString());
                publishConfirmationEvent(userId, matchId, List.of(), null,
                        false, response.getMessage(), startTime);
                return response;
            }

            // 2. 매치 상태에 따라 유저가 선점한 좌석 조회 (Redis 또는 DB)
            List<String> seatIds = findUserSeats(matchId, userId, match.getStatus());

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

            // 4. 등수 계산 (humanusers 카운터 감소)
            Integer userRank = calculateUserRank(matchId, userId);

            // 5. user_stats 저장
            UserStats userStats = UserStats.builder()
                    .userId(userId)
                    .matchId(matchId)
                    .isSuccess(true)
                    .selectedSection(selectedSection)
                    .selectedSeat(selectedSeat)
                    .dateSelectTime(request.getDateSelectTime() != null ? request.getDateSelectTime() : 0)
                    .dateMissCount(request.getDateMissCount() != null ? request.getDateMissCount() : 0)
                    .seccodeSelectTime(request.getSeccodeSelectTime() != null ? request.getSeccodeSelectTime() : 0)
                    .seccodeBackspaceCount(request.getSeccodeBackspaceCount() != null ? request.getSeccodeBackspaceCount() : 0)
                    .seccodeTryCount(request.getSeccodeTryCount() != null ? request.getSeccodeTryCount() : 0)
                    .seatSelectTime(request.getSeatSelectTime() != null ? request.getSeatSelectTime() : 0)
                    .seatSelectTryCount(request.getSeatSelectTryCount() != null ? request.getSeatSelectTryCount() : 0)
                    .seatSelectClickMissCount(request.getSeatSelectClickMissCount() != null ? request.getSeatSelectClickMissCount() : 0)
                    .userRank(userRank)
                    .totalRank(-1)  // 전체 경기 종료 후 계산
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();

            userStatsRepository.save(userStats);

            // 6. 성공 응답 생성
            SeatConfirmationResponse response = SeatConfirmationResponse.builder()
                    .success(true)
                    .message("개인 경기 종료")
                    .userRank(userRank)
                    .confirmedSeats(confirmedSeats)
                    .matchId("match" + matchId)
                    .userId(userId.toString())
                    .build();

            // 7. 이벤트 발행
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
     * 매치 상태에 따라 유저가 선점한 좌석 조회
     * - PLAYING: Redis에서 조회
     * - FINISHED: DB(user_stats)에서 조회
     */
    private List<String> findUserSeats(Long matchId, Long userId, Match.MatchStatus matchStatus) {
        if (matchStatus == Match.MatchStatus.PLAYING) {
            log.info("전체 경기 진행 중 - Redis에서 좌석 조회: matchId={}, userId={}", matchId, userId);
            return findUserSeatsFromRedis(matchId, userId);
        } else if (matchStatus == Match.MatchStatus.FINISHED) {
            log.info("전체 경기 종료 - DB에서 좌석 조회: matchId={}, userId={}", matchId, userId);
            return findUserSeatsFromDB(matchId, userId);
        } else {
            log.warn("매치 상태가 WAITING입니다. 좌석 조회 불가: matchId={}, status={}", matchId, matchStatus);
            return List.of();
        }
    }

    /**
     * Redis에서 해당 유저가 선점한 좌석 조회
     */
    private List<String> findUserSeatsFromRedis(Long matchId, Long userId) {
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
                            // key 형식: seat:100:008:9-15 -> seatId: 008-9-15
                            String seatId = extractSeatIdFromKey(key);
                            userSeats.add(seatId);
                        }
                    }
                }
            }
        }

        log.debug("Redis 조회 결과: matchId={}, userId={}, 좌석 수={}", matchId, userId, userSeats.size());
        return userSeats;
    }

    /**
     * DB(user_stats)에서 해당 유저가 확정한 좌석 조회
     */
    private List<String> findUserSeatsFromDB(Long matchId, Long userId) {
        List<UserStats> stats = userStatsRepository.findByMatchIdAndUserId(matchId, userId);

        List<String> userSeats = stats.stream()
                .filter(UserStats::getIsSuccess)  // 성공한 경우만
                .map(UserStats::getSelectedSeat)   // "008-9-15" 형식
                .toList();

        log.debug("DB 조회 결과: matchId={}, userId={}, 좌석 수={}", matchId, userId, userSeats.size());
        return userSeats;
    }

    /**
     * Redis 키에서 seatId 추출
     * 예: "seat:100:008:9-15" -> "008-9-15"
     */
    private String extractSeatIdFromKey(String key) {
        String[] parts = key.split(":");
        if (parts.length >= 4) {
            return parts[2] + "-" + parts[3];
        }
        return "";
    }

    /**
     * 등수 계산 (humanusers 카운터 감소)
     */
    private Integer calculateUserRank(Long matchId, Long userId) {
        // userId가 양수일 때만 humanusers 카운터 감소
        if (userId > 0) {
            String humanUsersKey = "humanusers:match:" + matchId;
            Long remainingUsers = redisTemplate.opsForValue().decrement(humanUsersKey);

            if (remainingUsers != null) {
                // 등수 = (초기값 - 남은 유저 수)
                String initialCountKey = "humanusers:match:" + matchId + ":initial";
                String initialCountStr = redisTemplate.opsForValue().get(initialCountKey);

                if (initialCountStr != null) {
                    int initialCount = Integer.parseInt(initialCountStr);
                    return initialCount - remainingUsers.intValue();
                }
            }
        }

        return -1;  // 봇이거나 계산 실패
    }

    /**
     * seatId에서 sectionId 추출
     * 예: "008-9-15" -> "008"
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

    private SeatConfirmationResponse buildClosedResponse(Long matchId, String userId) {
        return SeatConfirmationResponse.builder()
                .success(false)
                .message("이 이벤트는 더 이상 예매할 수 없습니다.")
                .matchId("match" + matchId)
                .status("CLOSED")
                .build();
    }
}