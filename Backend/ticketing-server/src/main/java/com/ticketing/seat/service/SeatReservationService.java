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
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeatReservationService {

    private static final int MAX_SEATS_PER_REQUEST = 2;
    private static final int MATCH_REDIS_TTL_SECONDS = 1800; // 30분
    private final StringRedisTemplate redisTemplate;
    private final RoomServerClient roomServerClient;

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
        if (req.getUserId() > 0 && (req.getTotalSeats() == null || req.getTotalSeats() <= 0)) {
            throw new IllegalArgumentException("Total seats must be provided and greater than 0");
        }

        // 1-2. 각 좌석에 grade가 있는지 확인 (없으면 최상위 grade 사용)
        validateAndFillGrades(req);

//        // 1-3. Redis 경기 상태 확인 전에 초기화 확인
//        String statusKey = "match:" + matchId + ":status";
//        if (Boolean.FALSE.equals(redisTemplate.hasKey(statusKey))) {
//            // status 키가 없으면 OPEN으로 초기화
//            redisTemplate.opsForValue().set(statusKey, "OPEN",
//                    Duration.ofSeconds(MATCH_REDIS_TTL_SECONDS));
//            log.info("매치 status 키 초기화: matchId={}, status=OPEN", matchId);
//        }

        // 2. DB에서 경기 정보 조회
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("Match not found: " + matchId));

        if (match.getStatus() != Match.MatchStatus.PLAYING) {
            throw new MatchClosedException(matchId);
        }

        // 2-1. Room 서버에서 totalSeats 조회
        Long roomId = match.getRoomId();
        Integer totalSeats = roomServerClient.getTotalSeats(roomId);

        if (totalSeats == null || totalSeats <= 0) {
            log.error("전체 좌석 수 조회 실패: matchId={}, roomId={}", matchId, roomId);
            throw new IllegalStateException("전체 좌석 수를 조회할 수 없습니다.");
        }

        log.info("전체 좌석 수 조회 성공: matchId={}, roomId={}, totalSeats={}",
                matchId, roomId, totalSeats);

        // 3. Redis 경기 상태 확인 (OPEN이면 예약 가능)
        boolean redisOpen = matchStatusRepository.isOpen(matchId);
        if (!redisOpen) {
            throw new MatchClosedException(matchId);
        }

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
        // Hold 시점:
        // - 좌석 키만 저장
        // - reserved_count 변경 없음
        // - humanusers 변경 없음
        Long result = luaReservationExecutor.tryReserveSeatsAtomically(
                matchId,
                sectionId,  // String 타입 (Redis 키)
                rowNumbers,
                userId,
                grades,     // 각 좌석의 grade 리스트
                totalSeats
        );

        // 5-1. 실패 처리 (이미 선점된 좌석)
        if (result == null || result == 0L) {
            log.warn("좌석 선점 실패 (이미 선점됨): matchId={}, userId={}, seats={}",
                    matchId, userId, rowNumbers);

            //  실패 통계 저장하지 않음 (단순 충돌)
            return buildFailureResponse(matchId, req);
        }

        // 5-2. 성공 시 TTL 설정
        setMatchRedisTTL(matchId);

        log.info("좌석 선점 성공: matchId={}, userId={}, seats={}",
                matchId, userId, rowNumbers);

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

            // 2. reserved_count 키 (Confirm된 좌석 수)
            String reservedCountKey = "match:" + matchId + ":reserved_count";
            redisTemplate.expire(reservedCountKey, ttl);

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
                .message("좌석 선점 실패: 이미 다른 사용자가 선점했습니다.")
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
                .message("좌석 선점 성공")
                .build();
    }
}