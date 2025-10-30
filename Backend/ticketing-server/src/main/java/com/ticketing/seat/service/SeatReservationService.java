package com.ticketing.seat.service;

import com.ticketing.seat.concurrency.LuaReservationExecutor;
import com.ticketing.seat.dto.ReservedSeatInfoDto;
import com.ticketing.seat.dto.SeatReservationRequest;
import com.ticketing.seat.dto.SeatReservationResponse;
import com.ticketing.seat.entity.Match;
import com.ticketing.seat.exception.MatchClosedException;
import com.ticketing.seat.exception.ReservationConflictException;
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

    @Transactional
    public SeatReservationResponse reserveSeats(SeatReservationRequest req) {
        Long matchId = req.getMatchId();
        Long userId  = req.getUserId();

        int requested = (req.getSeatIds() == null) ? 0 : req.getSeatIds().size();
        if (requested == 0 || requested > MAX_SEATS_PER_REQUEST) {
            throw new TooManySeatsRequestedException(requested);
        }

        boolean redisOpen = matchStatusRepository.isOpen(matchId);
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("Match not found: " + matchId));
        boolean dbPlayable = match.getStatus() == Match.MatchStatus.PLAYING;

        if (!(redisOpen && dbPlayable)) {
            throw new MatchClosedException(matchId);
        }

        boolean ok = luaReservationExecutor.tryReserveSeatsAtomically(matchId, req.getSeatIds(), userId);

        if (!ok) {
            // 전체 실패: 요청 seatIds 전부 failed로 내려줌
            List<ReservedSeatInfoDto> failed = req.getSeatIds().stream()
                    .map(seatId -> {
                        SeatMetaService.SeatMeta meta = seatMetaService.resolve(matchId, seatId);
                        return ReservedSeatInfoDto.builder()
                                .sectionId(meta.getSectionId())
                                .seatId(seatId)
                                .grade(meta.getGrade())
                                .expiresAt(null)      // TTL 미사용 → null
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

        // 전체 성공: 요청 seatIds 전부 held로 내려줌
        List<ReservedSeatInfoDto> held = req.getSeatIds().stream()
                .map(seatId -> {
                    SeatMetaService.SeatMeta meta = seatMetaService.resolve(matchId, seatId);
                    return ReservedSeatInfoDto.builder()
                            .sectionId(meta.getSectionId())
                            .seatId(seatId)
                            .grade(meta.getGrade())
                            .expiresAt(null)      // TTL 미사용 → null
                            .matchId(matchId)
                            .build();
                })
                .toList();

        // (선택) 이 시점에서 user_stats/match_stats 적재는 다음 단계에서 활성화
        return SeatReservationResponse.builder()
                .success(true)
                .heldSeats(held)
                .failedSeats(List.of())
                .build();
    }
}
