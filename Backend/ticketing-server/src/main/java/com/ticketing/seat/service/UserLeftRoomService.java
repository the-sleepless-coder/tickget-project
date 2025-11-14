package com.ticketing.seat.service;

import com.ticketing.entity.Match;
import com.ticketing.entity.UserStats;
import com.ticketing.repository.MatchRepository;
import com.ticketing.repository.UserStatsRepository;
import com.ticketing.seat.concurrency.LuaCancelExecutor;
import com.ticketing.seat.dto.SeatInfo;
import com.ticketing.seat.dto.UserLeftRoomResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * 경기 중간 퇴장 유저 처리 서비스
 *
 * 유저가 경기 중에 방을 나갔을 때 3가지 케이스:
 * 1. Hold 안 함: humanusers만 감소
 * 2. Hold만 함: 좌석 취소 + reserved_count 감소 + humanusers 감소
 * 3. Confirm 완료: 아무것도 안 함 (이미 처리 완료)
 *
 * 판단 순서:
 * 1) DB user_stats 확인 (Confirm 여부) → 있으면 종료
 * 2) Redis 좌석 키 확인 (Hold 여부) → 있으면 취소 + humanusers 감소
 * 3) 둘 다 없으면 → humanusers만 감소
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserLeftRoomService {

    private final MatchRepository matchRepository;
    private final UserStatsRepository userStatsRepository;
    private final StringRedisTemplate redisTemplate;
    private final LuaCancelExecutor luaCancelExecutor;

    @Transactional
    public UserLeftRoomResponse handleUserLeftRoom(Long roomId, Long userId) {
        log.info("경기 중 유저 퇴장 처리 시작: roomId={}, userId={}", roomId, userId);

        try {
            // 0. 봇인 경우 처리하지 않음
            boolean isBot = userId < 0;
            if (isBot) {
                log.info("봇 유저는 퇴장 처리하지 않음: userId={}", userId);
                return UserLeftRoomResponse.builder()
                        .success(true)
                        .message("봇 유저는 처리하지 않음")
                        .matchId(null)
                        .userId(userId)
                        .cancelledSeatCount(0)
                        .statusChangedToOpen(false)
                        .build();
            }

            // 1. DB에서 roomId로 가장 최근 매치 조회
            Match match = matchRepository.findTopByRoomIdOrderByCreatedAtDesc(roomId).orElse(null);

            if (match == null) {
                log.warn("매치를 찾을 수 없음: roomId={}", roomId);
                return buildErrorResponse("매치를 찾을 수 없습니다.", roomId, userId);
            }

            Long matchId = match.getMatchId();
            log.info("매치 조회 완료: matchId={}, status={}", matchId, match.getStatus());

            // 3. 매치가 이미 종료되었으면 처리하지 않음
            if (match.getStatus() == Match.MatchStatus.FINISHED) {
                log.info("매치가 이미 종료됨: matchId={}, userId={}", matchId, userId);
                return UserLeftRoomResponse.builder()
                        .success(true)
                        .message("매치가 이미 종료되어 처리하지 않음")
                        .matchId(matchId)
                        .userId(userId)
                        .cancelledSeatCount(0)
                        .statusChangedToOpen(false)
                        .build();
            }

            // 4. DB user_stats 확인 (Confirm 완료 여부)
            boolean hasConfirmed = userStatsRepository.existsByUserIdAndMatchId(userId, matchId);

            if (hasConfirmed) {
                log.info("이미 Confirm 완료한 유저: matchId={}, userId={} → 처리하지 않음", matchId, userId);
                return UserLeftRoomResponse.builder()
                        .success(true)
                        .message("이미 개인 경기 완료")
                        .matchId(matchId)
                        .userId(userId)
                        .cancelledSeatCount(0)
                        .statusChangedToOpen(false)
                        .build();
            }

            // 5. Redis 좌석 키 확인 (Hold 여부)
            List<SeatInfo> userSeats = findUserSeatsInfo(matchId, userId);

            if (!userSeats.isEmpty()) {
                // 케이스 2: Hold 했지만 Confirm 안 함 → 좌석 취소 + humanusers 감소
                log.info("Hold 했지만 미확정 좌석 발견: matchId={}, userId={}, seatCount={}",
                        matchId, userId, userSeats.size());

                UserLeftRoomResponse response = cancelUserSeatsAndDecreaseHumanUsers(
                        matchId, userId, userSeats, match);

                return response;

            } else {
                // 케이스 1: Hold 안 함 → humanusers만 감소
                log.info("선점한 좌석 없음 (Hold 안 함): matchId={}, userId={} → humanusers만 감소",
                        matchId, userId);

                decreaseHumanUsers(matchId, userId);

                return UserLeftRoomResponse.builder()
                        .success(true)
                        .message("좌석 선점 안 했음, 실제 유저 수만 감소")
                        .matchId(matchId)
                        .userId(userId)
                        .cancelledSeatCount(0)
                        .statusChangedToOpen(false)
                        .build();
            }

        } catch (Exception e) {
            log.error("유저 퇴장 처리 중 오류 발생: roomId={}, userId={}, error={}",
                    roomId, userId, e.getMessage(), e);
            return buildErrorResponse("처리 중 오류 발생: " + e.getMessage(), null, userId);
        }
    }

    /**
     * Redis에서 roomId로 matchId 조회
     * 키 패턴: room:{roomId}:match:{matchId}
     */

    /**
     * humanusers:match:{matchId} 카운터 감소
     * 실제 유저가 경기에서 이탈할 때 호출
     */
    private void decreaseHumanUsers(Long matchId, Long userId) {
        String humanUsersKey = "humanusers:match:" + matchId;
        Long remaining = redisTemplate.opsForValue().decrement(humanUsersKey);

        log.info("실제 유저 수 감소: matchId={}, userId={}, 남은 실제 유저={}",
                matchId, userId, remaining);

        // 음수 방지
        if (remaining != null && remaining < 0) {
            redisTemplate.opsForValue().set(humanUsersKey, "0");
            log.warn("humanusers가 음수가 됨, 0으로 보정: matchId={}", matchId);
        }
    }

    /**
     * 유저의 선점 좌석을 섹션별로 원자적 취소 + humanusers 감소
     */
    private UserLeftRoomResponse cancelUserSeatsAndDecreaseHumanUsers(Long matchId, Long userId,
                                                                      List<SeatInfo> userSeats, Match match) {
        int totalCancelledSeats = 0;
        boolean statusChangedToOpen = false;

        // 섹션별로 그룹화
        var seatsBySection = userSeats.stream()
                .collect(java.util.stream.Collectors.groupingBy(SeatInfo::getSectionId));

        for (var entry : seatsBySection.entrySet()) {
            Long sectionId = entry.getKey();
            List<SeatInfo> seatsInSection = entry.getValue();

            // rowNumber 추출
            List<String> rowNumbers = seatsInSection.stream()
                    .map(SeatInfo::toRowNumber)
                    .toList();

            log.info("섹션 {}의 좌석 취소 시도: matchId={}, userId={}, seats={}",
                    sectionId, matchId, userId, rowNumbers);

            // Lua 스크립트로 원자적 취소
            Long result = luaCancelExecutor.tryCancelSeatsAtomically(
                    matchId,
                    String.valueOf(sectionId),
                    rowNumbers,
                    userId,
                    match.getMaxUser()
            );

            if (result != null && result > 0L) {
                totalCancelledSeats += seatsInSection.size();

                if (result == 2L) {
                    statusChangedToOpen = true;
                    log.info("만석 상태가 OPEN으로 복구됨: matchId={}", matchId);
                }
            } else {
                log.warn("좌석 취소 실패: matchId={}, userId={}, sectionId={}",
                        matchId, userId, sectionId);
            }
        }

        // 좌석 취소 후 humanusers 감소
        decreaseHumanUsers(matchId, userId);

        log.info("유저 퇴장 처리 완료: matchId={}, userId={}, cancelledSeats={}, statusChanged={}",
                matchId, userId, totalCancelledSeats, statusChangedToOpen);

        return UserLeftRoomResponse.builder()
                .success(true)
                .message("퇴장 처리 완료 (좌석 취소 + 실제 유저 수 감소)")
                .matchId(matchId)
                .userId(userId)
                .cancelledSeatCount(totalCancelledSeats)
                .statusChangedToOpen(statusChangedToOpen)
                .build();
    }

    /**
     * Redis에서 해당 유저의 좌석 정보 조회
     */
    private List<SeatInfo> findUserSeatsInfo(Long matchId, Long userId) {
        List<SeatInfo> userSeats = new ArrayList<>();

        String pattern = "seat:" + matchId + ":*";
        Set<String> keys = redisTemplate.keys(pattern);

        if (keys != null) {
            for (String key : keys) {
                String value = redisTemplate.opsForValue().get(key);
                if (value != null) {
                    String[] parts = value.split(":");
                    if (parts.length == 2) {
                        Long ownerId = Long.valueOf(parts[0]);
                        String grade = parts[1];

                        if (ownerId.equals(userId)) {
                            // key 형식: seat:100:8:9-15
                            // sectionId = 8, row = 9, col = 15
                            SeatInfo seatInfo = extractSeatInfoFromKey(key, grade);
                            if (seatInfo != null) {
                                userSeats.add(seatInfo);
                            }
                        }
                    }
                }
            }
        }

        return userSeats;
    }

    /**
     * Redis 키에서 SeatInfo 추출
     * 예: "seat:100:8:9-15" + grade "R석" -> SeatInfo(8, 9, 15, "R석")
     */
    private SeatInfo extractSeatInfoFromKey(String key, String grade) {
        String[] parts = key.split(":");
        if (parts.length >= 4) {
            try {
                Long sectionId = Long.valueOf(parts[2]);
                String[] rowCol = parts[3].split("-");
                if (rowCol.length == 2) {
                    Long row = Long.valueOf(rowCol[0]);
                    Long col = Long.valueOf(rowCol[1]);

                    return SeatInfo.builder()
                            .sectionId(sectionId)
                            .row(row)
                            .col(col)
                            .grade(grade)
                            .build();
                }
            } catch (NumberFormatException e) {
                log.error("좌석 정보 파싱 실패: key={}", key, e);
            }
        }
        return null;
    }

    private UserLeftRoomResponse buildErrorResponse(String message, Long matchId, Long userId) {
        return UserLeftRoomResponse.builder()
                .success(false)
                .message(message)
                .matchId(matchId)
                .userId(userId)
                .cancelledSeatCount(0)
                .statusChangedToOpen(false)
                .build();
    }
}