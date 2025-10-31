package com.ticketing.seat.service;

import com.ticketing.seat.concurrency.LuaReservationExecutor;
import com.ticketing.seat.dto.ReservedSeatInfoDto;
import com.ticketing.seat.dto.SeatReservationRequest;
import com.ticketing.seat.dto.SeatReservationResponse;
import com.ticketing.seat.entity.Match;
import com.ticketing.seat.exception.MatchClosedException;
import com.ticketing.seat.exception.TooManySeatsRequestedException;
import com.ticketing.seat.redis.MatchStatusRepository;
import com.ticketing.seat.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SeatReservationService {

    private static final int MAX_SEATS_PER_REQUEST = 2;

    private final MatchRepository matchRepository;
    private final MatchStatusRepository matchStatusRepository;
    private final LuaReservationExecutor luaReservationExecutor;
    private final SeatMetaService seatMetaService;
    private final SeatCountService seatCountService;

    @Transactional(readOnly = true)
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

        // 4. Redis 원자적 선점 시도 (좌석 선점 + 카운트 증가 + 만석 시 자동 CLOSED)
        boolean ok = luaReservationExecutor.tryReserveSeatsAtomically(
                matchId,
                req.getSeatIds(),
                userId,
                match.getMaxUser()
        );

        if (!ok) {
            return buildFailureResponse(matchId, req.getSeatIds(), "Seats already taken");
        }

        return buildSuccessResponse(matchId, req.getSeatIds());
    }

    private SeatReservationResponse buildFailureResponse(Long matchId, List<String> seatIds, String reason) {
        List<ReservedSeatInfoDto> failed = seatIds.stream()
                .map(seatId -> {
                    SeatMetaService.SeatMeta meta = seatMetaService.resolve(matchId, seatId);
                    return ReservedSeatInfoDto.builder()
                            .sectionId(meta.getSectionId())
                            .seatId(seatId)
                            .grade(meta.getGrade())
                            .expiresAt(null)
                            .matchId(matchId)
                            .build();
                })
                .toList();

        return SeatReservationResponse.builder()
                .success(false)
                .heldSeats(List.of())
                .failedSeats(failed)
                .build();
    }

    private SeatReservationResponse buildSuccessResponse(Long matchId, List<String> seatIds) {
        List<ReservedSeatInfoDto> held = seatIds.stream()
                .map(seatId -> {
                    SeatMetaService.SeatMeta meta = seatMetaService.resolve(matchId, seatId);
                    return ReservedSeatInfoDto.builder()
                            .sectionId(meta.getSectionId())
                            .seatId(seatId)
                            .grade(meta.getGrade())
                            .expiresAt(null)
                            .matchId(matchId)
                            .build();
                })
                .toList();

        return SeatReservationResponse.builder()
                .success(true)
                .heldSeats(held)
                .failedSeats(List.of())
                .build();
    }
}