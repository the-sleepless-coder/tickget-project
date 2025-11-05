package com.ticketing.seat.service;

import com.ticketing.seat.dto.SeatStatusDto;
import com.ticketing.seat.dto.SeatStatusResponse;
import com.ticketing.seat.entity.Match;
import com.ticketing.seat.exception.MatchClosedException;
import com.ticketing.seat.exception.MatchNotFoundException;
import com.ticketing.seat.redis.MatchStatusRepository;
import com.ticketing.seat.repository.MatchRepository;
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
public class SeatStatusService {

    private final MatchRepository matchRepository;
    private final MatchStatusRepository matchStatusRepository;
    private final StringRedisTemplate redisTemplate;

    /**
     * 섹션 내 선점된 좌석 정보만 조회
     * @param matchId 경기 ID
     * @param sectionId 섹션 ID
     * @param userId 사용자 ID (내 선점 좌석 구분용)
     * @return 선점된 좌석만 반환 (프론트가 나머지는 AVAILABLE로 판단)
     */
    @Transactional(readOnly = true)
    public SeatStatusResponse getSeatStatus(Long matchId, String sectionId, Long userId) {
        // 1. 매치 존재 확인
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new MatchNotFoundException(matchId));

        // 2. 매치 상태 확인 (PLAYING만 조회 가능)
        if (match.getStatus() != Match.MatchStatus.PLAYING) {
            throw new MatchClosedException(matchId);
        }

        // 3. Redis 매치 상태 확인
        String redisStatus = matchStatusRepository.getMatchStatus(matchId);
        if (!"OPEN".equalsIgnoreCase(redisStatus)) {
            throw new MatchClosedException(matchId);
        }

        // 4. Redis에서 해당 섹션의 선점된 좌석만 조회
        // 키 패턴: seat:{matchId}:{sectionId}:*
        String pattern = "seat:" + matchId + ":" + sectionId + ":*";
        Set<String> keys = redisTemplate.keys(pattern);

        List<SeatStatusDto> seats = new ArrayList<>();
        String grade = null;

        if (keys != null && !keys.isEmpty()) {
            for (String key : keys) {
                // seat:100:008:9-15 -> 9-15 추출
                String rowNumber = extractRowNumberFromKey(key);
                String seatId = sectionId + "-" + rowNumber;

                // Redis 값: userId:grade
                String value = redisTemplate.opsForValue().get(key);
                if (value == null) continue;

                String[] parts = value.split(":");
                if (parts.length != 2) continue;

                Long ownerId = Long.valueOf(parts[0]);
                String seatGrade = parts[1];

                // 등급 정보 추출 (한 번만)
                if (grade == null) {
                    grade = seatGrade;
                }

                // 상태 판단
                String status = ownerId.equals(userId) ? "MY_RESERVED" : "TAKEN";

                seats.add(SeatStatusDto.builder()
                        .seatId(seatId)
                        .status(status)
                        .build());
            }
        }

        // 5. 등급 정보가 없으면 기본값 (선점된 좌석이 없는 경우)
        if (grade == null) {
            grade = "UNKNOWN";
        }

        return SeatStatusResponse.builder()
                .sectionId(sectionId)
                .grade(grade)
                .seats(seats)
                .build();
    }

    /**
     * Redis 키에서 rowNumber 추출
     * 예: "seat:100:008:9-15" -> "9-15"
     */
    private String extractRowNumberFromKey(String key) {
        String[] parts = key.split(":");
        return parts.length >= 4 ? parts[3] : "";
    }
}