package com.ticketing.seat.service;

import com.ticketing.entity.Match;
import com.ticketing.repository.MatchRepository;
import com.ticketing.repository.UserStatsRepository;
import com.ticketing.seat.concurrency.LuaCancelExecutor;
import com.ticketing.seat.dto.SeatCancelResponse;
import com.ticketing.seat.dto.SeatInfo;
import com.ticketing.seat.exception.MatchNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeatCancelService {

    private final MatchRepository matchRepository;
    private final UserStatsRepository userStatsRepository;
    private final LuaCancelExecutor luaCancelExecutor;
    private final StringRedisTemplate redisTemplate;

    @Transactional
    public SeatCancelResponse cancelSeats(Long matchId, Long userId) {

        try {
            // 1. Match 조회
            Match match = matchRepository.findById(matchId)
                    .orElseThrow(() -> new MatchNotFoundException(matchId));

            // 2. DB에서 이미 Confirm 했는지 확인
            boolean alreadyConfirmed = !userStatsRepository
                    .findByMatchIdAndUserId(matchId, userId)
                    .isEmpty();

            if (alreadyConfirmed) {
                log.warn("이미 확정된 좌석 취소 시도: matchId={}, userId={}", matchId, userId);
                return SeatCancelResponse.builder()
                        .success(false)
                        .message("이미 확정된 좌석은 취소할 수 없습니다.")
                        .matchId(matchId)
                        .userId(userId)
                        .cancelledSeatCount(0)
                        .build();
            }

            // 3. Redis에서 해당 유저의 좌석 조회
            List<SeatInfo> userSeats = findUserSeatsInfo(matchId, userId);

            if (userSeats.isEmpty()) {
                log.warn("취소할 좌석 없음: matchId={}, userId={}", matchId, userId);
                return SeatCancelResponse.builder()
                        .success(false)
                        .message("취소할 좌석이 없습니다.")
                        .matchId(matchId)
                        .userId(userId)
                        .cancelledSeatCount(0)
                        .build();
            }

            // 4. 좌석 정보 추출
            String sectionId = userSeats.get(0).getSectionId().toString();
            List<String> rowNumbers = userSeats.stream()
                    .map(SeatInfo::toRowNumber)
                    .toList();

            // 5. Lua 스크립트로 원자적 취소
            Long result = luaCancelExecutor.tryCancelSeatsAtomically(
                    matchId,
                    sectionId,
                    rowNumbers,
                    userId,
                    match.getMaxUser()
            );

            // 6. 결과 처리
            if (result == null || result == 0L) {
                log.error("좌석 취소 실패: matchId={}, userId={}", matchId, userId);
                return SeatCancelResponse.builder()
                        .success(false)
                        .message("좌석 취소에 실패했습니다.")
                        .matchId(matchId)
                        .userId(userId)
                        .cancelledSeatCount(0)
                        .build();
            }

            // 7. 성공 응답
            String message;
            if (result == 2L) {
                message = "좌석 취소 완료 (만석 해제됨)";
                log.info("좌석 취소 + OPEN 복구: matchId={}, userId={}, seats={}",
                        matchId, userId, rowNumbers.size());
            } else {
                message = "좌석 취소 완료";
                log.info("좌석 취소 성공: matchId={}, userId={}, seats={}",
                        matchId, userId, rowNumbers.size());
            }

            return SeatCancelResponse.builder()
                    .success(true)
                    .message(message)
                    .matchId(matchId)
                    .userId(userId)
                    .cancelledSeatCount(rowNumbers.size())
                    .build();

        } catch (Exception e) {
            log.error("좌석 취소 중 오류 발생: matchId={}, userId={}", matchId, userId, e);
            return SeatCancelResponse.builder()
                    .success(false)
                    .message("좌석 취소 처리 중 오류가 발생했습니다: " + e.getMessage())
                    .matchId(matchId)
                    .userId(userId)
                    .cancelledSeatCount(0)
                    .build();
        }
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
}