package com.ticketing.seat.service;

import com.ticketing.seat.concurrency.LuaCancelExecutor;
import com.ticketing.seat.dto.SeatCancelResponse;
import com.ticketing.seat.dto.SeatInfo;
import com.ticketing.entity.Match;
import com.ticketing.seat.exception.MatchNotFoundException;
import com.ticketing.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeatCancelService {

    private final MatchRepository matchRepository;
    private final StringRedisTemplate redisTemplate;
    private final LuaCancelExecutor luaCancelExecutor;

    @Transactional
    public SeatCancelResponse cancelSeats(Long matchId, Long userId) {
        try {
            // 1. Match 조회
            Match match = matchRepository.findById(matchId)
                    .orElseThrow(() -> new MatchNotFoundException(matchId));

            // 2. Redis에서 해당 유저의 좌석 정보 조회
            List<SeatInfo> userSeats = findUserSeatsInfo(matchId, userId);

            if (userSeats.isEmpty()) {
                return SeatCancelResponse.builder()
                        .success(false)
                        .message("취소할 좌석이 없습니다.")
                        .matchId(matchId)
                        .userId(userId)
                        .cancelledSeatCount(0)
                        .build();
            }

            // 3. 섹션별로 그룹화
            Map<Long, List<SeatInfo>> seatsBySection = userSeats.stream()
                    .collect(Collectors.groupingBy(SeatInfo::getSectionId));

            int totalCancelledSeats = 0;

            // 4. 섹션별로 Lua 스크립트 실행
            for (Map.Entry<Long, List<SeatInfo>> entry : seatsBySection.entrySet()) {
                Long sectionId = entry.getKey();
                List<SeatInfo> seatsInSection = entry.getValue();

                List<String> rowNumbers = seatsInSection.stream()
                        .map(SeatInfo::toRowNumber)
                        .toList();

                log.info("좌석 취소 시도: matchId={}, userId={}, sectionId={}, seats={}",
                        matchId, userId, sectionId, rowNumbers);

                // Lua 스크립트로 원자적 취소
                Long result = luaCancelExecutor.tryCancelSeatsAtomically(
                        matchId,
                        String.valueOf(sectionId),
                        rowNumbers,
                        userId,
                        0  // totalSeats 사용 안 함 (하위 호환성)
                );

                if (result != null && result == 1L) {
                    totalCancelledSeats += seatsInSection.size();
                    log.info("좌석 취소 성공: matchId={}, userId={}, sectionId={}, count={}",
                            matchId, userId, sectionId, seatsInSection.size());
                } else {
                    log.warn("좌석 취소 실패: matchId={}, userId={}, sectionId={}",
                            matchId, userId, sectionId);
                }
            }

            if (totalCancelledSeats > 0) {
                return SeatCancelResponse.builder()
                        .success(true)
                        .message("좌석 취소 성공")
                        .matchId(matchId)
                        .userId(userId)
                        .cancelledSeatCount(totalCancelledSeats)
                        .build();
            } else {
                return SeatCancelResponse.builder()
                        .success(false)
                        .message("좌석 취소 실패")
                        .matchId(matchId)
                        .userId(userId)
                        .cancelledSeatCount(0)
                        .build();
            }

        } catch (MatchNotFoundException e) {
            throw e;
        } catch (Exception e) {
            log.error("좌석 취소 중 오류 발생: matchId={}, userId={}", matchId, userId, e);
            return SeatCancelResponse.builder()
                    .success(false)
                    .message("좌석 취소 중 오류: " + e.getMessage())
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
                            // key 형식: seat:{matchId}:{sectionId}:{row}-{col}
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