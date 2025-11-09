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
    private final MatchStatusSyncService matchStatusSyncService;

    @Transactional
    public SeatReservationResponse reserveSeats(Long matchId, SeatReservationRequest req) {
        Long userId = req.getUserId();

        // 1. 좌석 개수 검증
        int requested = (req.getSeats() == null) ? 0 : req.getSeats().size();
        if (requested == 0 || requested > MAX_SEATS_PER_REQUEST) {
            throw new TooManySeatsRequestedException(requested);
        }

        // 1-1. totalSeats 필수 검증
        if (req.getTotalSeats() == null || req.getTotalSeats() <= 0) {
            throw new IllegalArgumentException("Total seats must be provided and greater than 0");
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

        // 3-1. 프론트에서 받은 totalSeats를 DB에 저장
        if (!match.getMaxUser().equals(req.getTotalSeats())) {
            log.info("totalSeats 업데이트: matchId={}, 기존값={}, 새로운값={}",
                    matchId, match.getMaxUser(), req.getTotalSeats());
            match.setMaxUser(req.getTotalSeats());
            match.setUpdatedAt(LocalDateTime.now());
            matchRepository.save(match);
        }

        // 4. SeatInfo -> rowNumber 변환 (extractSectionId 메서드 사용)
        String sectionId = req.extractSectionId();
        List<String> rowNumbers = req.getSeats().stream()
                .map(SeatInfo::toRowNumber)
                .toList();

        // 5. Redis 원자적 선점 시도
        Long result = luaReservationExecutor.tryReserveSeatsAtomically(
                matchId,
                sectionId,
                rowNumbers,
                userId,
                req.getGrade(),
                req.getTotalSeats()
        );

        // 6. 결과 처리
        if (result == null || result == 0L) {
            // 실패: 좌석 이미 선점됨
            return buildFailureResponse(matchId, req);
        }

        if (result == 2L) {
            // 성공 + 만석: DB 상태를 FINISHED로 변경하고 Redis 정리
            log.info("만석 감지: matchId={}, DB 상태를 FINISHED로 변경하고 Redis 정리합니다.", matchId);
            finishMatchDueToFullCapacity(match);
        }

        // 성공 응답
        return buildSuccessResponse(matchId, req);
    }

    /**
     * 만석으로 인한 경기 종료 처리
     * DB의 matches.status를 FINISHED로 변경하고 ended_at 기록
     * 경기 종료 즉시 Redis 데이터 정리
     */
    private void finishMatchDueToFullCapacity(Match match) {
        match.setStatus(Match.MatchStatus.FINISHED);
        match.setEndedAt(LocalDateTime.now());
        matchRepository.save(match);

        log.info("경기 자동 종료 완료: matchId={}, status=FINISHED, endedAt={}",
                match.getMatchId(), match.getEndedAt());

        // 경기 종료 즉시 Redis 데이터 정리
        matchStatusSyncService.cleanupMatchRedis(match.getMatchId());
    }

    /**
     * 실패 응답 생성
     */
    private SeatReservationResponse buildFailureResponse(Long matchId, SeatReservationRequest req) {
        List<ReservedSeatInfoDto> failed = req.getSeats().stream()
                .map(seat -> ReservedSeatInfoDto.builder()
                        .sectionId(seat.getSectionId().toString())
                        .seatId(seat.toSeatId())
                        .grade(req.getGrade())
                        .matchId(matchId)
                        .build())
                .toList();

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
        List<ReservedSeatInfoDto> held = req.getSeats().stream()
                .map(seat -> ReservedSeatInfoDto.builder()
                        .sectionId(seat.getSectionId().toString())
                        .seatId(seat.toSeatId())
                        .grade(req.getGrade())
                        .matchId(matchId)
                        .build())
                .toList();

        return SeatReservationResponse.builder()
                .success(true)
                .heldSeats(held)
                .failedSeats(List.of())
                .build();
    }
}