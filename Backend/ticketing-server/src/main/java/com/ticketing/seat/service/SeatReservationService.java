package com.ticketing.seat.service;

import com.ticketing.seat.concurrency.LuaReservationExecutor;
import com.ticketing.seat.dto.ReservedSeatInfoDto;
import com.ticketing.seat.dto.SeatReservationRequest;
import com.ticketing.seat.dto.SeatReservationResponse;
import com.ticketing.entity.Match;
import com.ticketing.seat.exception.MatchClosedException;
import com.ticketing.seat.exception.TooManySeatsRequestedException;
import com.ticketing.seat.redis.MatchStatusRepository;
import com.ticketing.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeatReservationService {

    private static final int MAX_SEATS_PER_REQUEST = 2;

    private final MatchRepository matchRepository;
    private final MatchStatusRepository matchStatusRepository;
    private final LuaReservationExecutor luaReservationExecutor;

    @Transactional
    public SeatReservationResponse reserveSeats(SeatReservationRequest req) {
        Long matchId = req.getMatchId();
        Long userId  = req.getUserId();

        // 1. 좌석 개수 검증
        int requested = (req.getSeatIds() == null) ? 0 : req.getSeatIds().size();
        if (requested == 0 || requested > MAX_SEATS_PER_REQUEST) {
            throw new TooManySeatsRequestedException(requested);
        }

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

        // 4. seatId -> rowNumber 변환 (예: "008-9-15" -> "9-15")
        List<String> rowNumbers = req.getSeatIds().stream()
                .map(this::extractRowNumber)
                .toList();

        // 5. Redis 원자적 선점 시도 (좌석 선점 + 카운트 증가 + 만석 시 자동 CLOSED)
        Long result = luaReservationExecutor.tryReserveSeatsAtomically(
                matchId,
                req.getSectionId(),
                rowNumbers,
                userId,
                req.getGrade(),
                match.getMaxUser()
        );

        // 6. 결과 처리
        if (result == null || result == 0L) {
            // 실패: 좌석 이미 선점됨
            return buildFailureResponse(req);
        }

        if (result == 2L) {
            // 성공 + 만석: DB 상태를 FINISHED로 변경
            log.info("만석 감지: matchId={}, DB 상태를 FINISHED로 변경합니다.", matchId);
            finishMatchDueToFullCapacity(match);
        }

        // 성공 응답
        return buildSuccessResponse(req);
    }

    /**
     * 만석으로 인한 경기 종료 처리
     * DB의 matches.status를 FINISHED로 변경하고 ended_at 기록
     */
    private void finishMatchDueToFullCapacity(Match match) {
        match.setStatus(Match.MatchStatus.FINISHED);
        match.setEndedAt(LocalDateTime.now());
        matchRepository.save(match);

        log.info("경기 자동 종료 완료: matchId={}, status=FINISHED, endedAt={}",
                match.getMatchId(), match.getEndedAt());
    }

    /**
     * seatId에서 rowNumber 추출
     * 예: "008-9-15" -> "9-15"
     */
    private String extractRowNumber(String seatId) {
        int firstDash = seatId.indexOf("-");
        return firstDash > 0 ? seatId.substring(firstDash + 1) : seatId;
    }

    private SeatReservationResponse buildFailureResponse(SeatReservationRequest req) {
        List<ReservedSeatInfoDto> failed = req.getSeatIds().stream()
                .map(seatId -> ReservedSeatInfoDto.builder()
                        .sectionId(req.getSectionId())
                        .seatId(seatId)
                        .grade(req.getGrade())
                        .matchId(req.getMatchId())
                        .build())
                .toList();

        return SeatReservationResponse.builder()
                .success(false)
                .heldSeats(List.of())
                .failedSeats(failed)
                .build();
    }

    private SeatReservationResponse buildSuccessResponse(SeatReservationRequest req) {
        List<ReservedSeatInfoDto> held = req.getSeatIds().stream()
                .map(seatId -> ReservedSeatInfoDto.builder()
                        .sectionId(req.getSectionId())
                        .seatId(seatId)
                        .grade(req.getGrade())
                        .matchId(req.getMatchId())
                        .build())
                .toList();

        return SeatReservationResponse.builder()
                .success(true)
                .heldSeats(held)
                .failedSeats(List.of())
                .build();
    }
}