package com.ticketing.seat.service;

import com.ticketing.seat.concurrency.LuaReservationExecutor;
import com.ticketing.seat.dto.ReservedSeatInfoDto;
import com.ticketing.seat.dto.SeatInfo;
import com.ticketing.seat.dto.SeatReservationRequest;
import com.ticketing.seat.dto.SeatReservationResponse;
import com.ticketing.entity.Match;
import com.ticketing.seat.exception.MatchClosedException;
import com.ticketing.seat.exception.TooManySeatsRequestedException;
import com.ticketing.seat.redis.MatchStatusRepository;
import com.ticketing.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeatReservationService {

    private static final int MAX_SEATS_PER_REQUEST = 2;
    private static final int MATCH_REDIS_TTL_SECONDS = 600; // 10분
    private final StringRedisTemplate redisTemplate;

    private final MatchRepository matchRepository;
    private final MatchStatusRepository matchStatusRepository;
    private final LuaReservationExecutor luaReservationExecutor;

    @Transactional
    public SeatReservationResponse reserveSeats(Long matchId, SeatReservationRequest req) {
        Long userId = req.getUserId();
        boolean isBot = userId < 0;  // 봇 여부 판단

        // 1. 좌석 개수 검증
        int requested = (req.getSeats() == null) ? 0 : req.getSeats().size();
        if (requested == 0 || requested > MAX_SEATS_PER_REQUEST) {
            throw new TooManySeatsRequestedException(requested);
        }

        // 1-1. totalSeats 필수 검증
        if (req.getTotalSeats() == null || req.getTotalSeats() <= 0) {
            throw new IllegalArgumentException("Total seats must be provided and greater than 0");
        }

        // 1-2. 각 좌석에 grade가 있는지 확인 (없으면 최상위 grade 사용)
        validateAndFillGrades(req);

        // 2. Redis 경기 상태 확인 (OPEN이면 예약 가능)
        boolean redisOpen = matchStatusRepository.isOpen(matchId);
        if (!redisOpen) {
            throw new MatchClosedException(matchId);
        }

        // 3. DB에서 경기 정보 조회
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("Match not found: " + matchId));

        if (match.getStatus() != Match.MatchStatus.PLAYING) {
            throw new MatchClosedException(matchId);
        }

//        // 3-1. 프론트에서 받은 totalSeats를 DB에 저장
//        if (!match.getMaxUser().equals(req.getTotalSeats())) {
//            log.info("totalSeats 업데이트: matchId={}, 기존값={}, 새로운값={}",
//                    matchId, match.getMaxUser(), req.getTotalSeats());
//            match.setMaxUser(req.getTotalSeats());
//            match.setUpdatedAt(LocalDateTime.now());
//            matchRepository.save(match);
//        }

        // 4. SeatInfo -> rowNumber, grade 변환
        String sectionId = req.extractSectionId();  // Long → String 변환 (Redis 키용)
        List<String> rowNumbers = req.getSeats().stream()
                .map(SeatInfo::toRowNumber)
                .toList();

        // 각 좌석의 grade 추출
        List<String> grades = req.getSeats().stream()
                .map(SeatInfo::getGrade)
                .toList();

        // 5. Redis 원자적 선점 시도 (각 좌석별 grade 전달)
        Long result = luaReservationExecutor.tryReserveSeatsAtomically(
                matchId,
                sectionId,  // String 타입 (Redis 키)
                rowNumbers,
                userId,
                grades,     // 각 좌석의 grade 리스트
                req.getTotalSeats()
        );

        // 5-1. 성공 시 매치 Redis 키들에 TTL 설정 (첫 Hold 이후 자동 정리 보장)
        if (result != null && result == 1L) {
            setMatchRedisTTL(matchId);
        }
        //마지막 좌석 잡은 유저
        if (result != null && result == 2L) {
            setMatchRedisTTL(matchId);
        }

        // 6. 결과 처리
        if (result == null || result == 0L) {
            return buildFailureResponse(matchId, req);
        }

        // ===== Hold 성공 시 실제 유저 등수 계산 =====
        if (!isBot) {
            calculateAndLogUserRank(matchId, userId);
        }

        // 만석 감지: Redis는 이미 CLOSED로 설정되어 더 이상 선점 불가
        // 하지만 DB는 PLAYING 유지 → 이미 선점한 유저들이 Confirm 가능하도록
        if (result == 2L) {
            log.info("만석 감지: matchId={}, Redis는 CLOSED 처리됨. DB는 PLAYING 유지하여 선점 유저들의 Confirm 허용", matchId);
            // DB 상태는 여기서 변경하지 않음 - Confirm 시점에서 처리
        }

        return buildSuccessResponse(matchId, req);
    }


    /**
     * 매치 관련 Redis 키에 TTL 설정 (10분)
     * Hold 첫 요청 시점에 호출하여 예상치 못한 종료 시 자동 정리
     */
    private void setMatchRedisTTL(Long matchId) {
        try {
            Duration ttl = Duration.ofSeconds(MATCH_REDIS_TTL_SECONDS);

            // 1. 상태 키
            String statusKey = "match:" + matchId + ":status";
            redisTemplate.expire(statusKey, ttl);

            // 2. 카운트 키들
            String reservedCountKey = "match:" + matchId + ":reserved_count";
            String confirmedCountKey = "match:" + matchId + ":confirmed_count";
            redisTemplate.expire(reservedCountKey, ttl);
            redisTemplate.expire(confirmedCountKey, ttl);

            // 3. 실제 유저 카운터
            String humanUsersKey = "humanusers:match:" + matchId;
            redisTemplate.expire(humanUsersKey, ttl);

            // 4. 등수 카운터
            String humanRankCounterKey = "match:" + matchId + ":human_rank_counter";
            String totalRankCounterKey = "match:" + matchId + ":total_rank_counter";
            redisTemplate.expire(humanRankCounterKey, ttl);
            redisTemplate.expire(totalRankCounterKey, ttl);

            log.info("매치 Redis 키 TTL 설정 완료: matchId={}, ttl={}초", matchId, MATCH_REDIS_TTL_SECONDS);

        } catch (Exception e) {
            log.error("매치 Redis TTL 설정 중 오류: matchId={}", matchId, e);
        }
    }


    /**
     * 실제 유저 등수 계산 및 전체 등수 계산 (Hold 시점)
     * - userRank: 실제 유저만 (봇 제외)
     * - totalRank: 봇 포함 전체 사용자
     */
    private void calculateAndLogUserRank(Long matchId, Long userId) {
        boolean isBot = userId < 0;
        Duration ttl = Duration.ofSeconds(MATCH_REDIS_TTL_SECONDS);

        // 1. userRank 계산 (실제 유저만)
        Integer userRank = null;
        if (!isBot) {
            final String rankKey = "match:" + matchId + ":human_rank_counter";
            try {
                Long rank = redisTemplate.opsForValue().increment(rankKey);
                if (rank != null) {
                    userRank = rank.intValue();

                    // Redis에 개별 유저 등수 저장 (Confirm 시 조회용)
                    String userRankKey = "user:" + userId + ":match:" + matchId + ":rank";
                    redisTemplate.opsForValue().set(userRankKey, String.valueOf(userRank), ttl);

                    log.info("Hold 시점 유저 등수 계산 (TTL 포함): userId={}, userRank={}", userId, rank);
                }
            } catch (Exception e) {
                log.error("Hold 시점 등수 계산 중 오류: matchId={}, userId={}", matchId, userId, e);
            }
        }

        // 2. totalRank 계산 (봇 포함 전체)
        final String totalRankKey = "match:" + matchId + ":total_rank_counter";
        try {
            Long totalRank = redisTemplate.opsForValue().increment(totalRankKey);
            if (totalRank != null) {
                // Redis에 개별 유저 전체 등수 저장 (Confirm 시 조회용)
                String userTotalRankKey = "user:" + userId + ":match:" + matchId + ":totalRank";
                redisTemplate.opsForValue().set(userTotalRankKey, String.valueOf(totalRank), ttl);

                log.info("Hold 시점 전체 등수 계산 (TTL 포함): userId={}, totalRank={}, isBot={}",
                        userId, totalRank, isBot);
            }
        } catch (Exception e) {
            log.error("Hold 시점 전체 등수 계산 중 오류: matchId={}, userId={}", matchId, userId, e);
        }
    }

    /**
     * 각 좌석에 grade가 있는지 확인하고, 없으면 최상위 grade 사용 (하위 호환성)
     */
    private void validateAndFillGrades(SeatReservationRequest req) {
        boolean hasGradeInSeats = req.getSeats().stream()
                .anyMatch(seat -> seat.getGrade() != null && !seat.getGrade().isEmpty());

        // 좌석에 grade가 하나도 없고, 최상위 grade도 없으면 에러
        if (!hasGradeInSeats && (req.getGrade() == null || req.getGrade().isEmpty())) {
            throw new IllegalArgumentException("Grade must be specified either in each seat or at the request level");
        }

        // 좌석에 grade가 없으면 최상위 grade를 각 좌석에 채움 (하위 호환성)
        if (!hasGradeInSeats && req.getGrade() != null) {
            log.debug("하위 호환성: 최상위 grade({})를 모든 좌석에 적용합니다.", req.getGrade());
            req.getSeats().forEach(seat -> seat.setGrade(req.getGrade()));
        }
    }

    /**
     * 실패 응답 생성
     */
    private SeatReservationResponse buildFailureResponse(Long matchId, SeatReservationRequest req) {
        List<ReservedSeatInfoDto> failed = new ArrayList<>();

        for (SeatInfo seat : req.getSeats()) {
            failed.add(ReservedSeatInfoDto.builder()
                    .sectionId(seat.getSectionId())  // Long 그대로 전달
                    .seatId(seat.toSeatId())
                    .grade(seat.getGrade())          // 각 좌석의 grade 사용
                    .build());
        }

        return SeatReservationResponse.builder()
                .success(false)
                .heldSeats(List.of())
                .failedSeats(failed)
                .build();
    }

    /**
     * 성공 응답 생성
     */
    private SeatReservationResponse buildSuccessResponse(Long matchId, SeatReservationRequest req) {
        List<ReservedSeatInfoDto> held = new ArrayList<>();

        for (SeatInfo seat : req.getSeats()) {
            held.add(ReservedSeatInfoDto.builder()
                    .sectionId(seat.getSectionId())  // Long 그대로 전달
                    .seatId(seat.toSeatId())
                    .grade(seat.getGrade())          // 각 좌석의 grade 사용
                    .build());
        }

        return SeatReservationResponse.builder()
                .success(true)
                .heldSeats(held)
                .failedSeats(List.of())
                .build();
    }
}