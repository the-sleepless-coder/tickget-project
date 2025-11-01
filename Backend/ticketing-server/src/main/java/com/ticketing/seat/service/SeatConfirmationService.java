package com.ticketing.seat.service;

import com.ticketing.seat.dto.ConfirmedSeatDto;
import com.ticketing.seat.dto.SeatConfirmationRequest;
import com.ticketing.seat.dto.SeatConfirmationResponse;
import com.ticketing.seat.entity.Match;
import com.ticketing.seat.exception.MatchNotFoundException;
import com.ticketing.seat.redis.MatchStatusRepository;
import com.ticketing.seat.redis.SeatReservationRedisRepository;
import com.ticketing.seat.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeatConfirmationService {

    private final MatchRepository matchRepository;
    private final MatchStatusRepository matchStatusRepository;
    private final SeatReservationRedisRepository seatReservationRedisRepository;
    private final SeatMetaService seatMetaService;
    private final EventPublisherService eventPublisherService;

    /**
     * 좌석 확정 서비스
     * 1. 매치 상태 확인
     * 2. Redis에서 좌석 상태 확인
     * 3. 좌석 확정 처리
     * 4. 카프카를 통해 이벤트 발행
     */
    @Transactional(readOnly = true)
    public SeatConfirmationResponse confirmSeats(Long matchId, SeatConfirmationRequest request) {
        long startTime = System.currentTimeMillis();

        if (request.getUserId() == null || request.getSeatIds() == null || request.getSeatIds().isEmpty()) {
            return buildErrorResponse("사용자 ID와 좌석 ID는 필수 입력 항목입니다.");
        }

        try {
            // 1. 매치 상태 확인
            Match match = matchRepository.findById(matchId)
                    .orElseThrow(() -> new MatchNotFoundException(matchId));

            if (match.getStatus() != Match.MatchStatus.PLAYING) {
                SeatConfirmationResponse response = buildClosedResponse(matchId, request.getUserId().toString());

                // 실패 이벤트 발행
                publishConfirmationEvent(request.getUserId(), matchId, request.getSeatIds(), null,
                        false, response.getMessage(), startTime);

                return response;
            }

            String redisStatus = matchStatusRepository.getMatchStatus(matchId);
            if (!"OPEN".equalsIgnoreCase(redisStatus)) {
                SeatConfirmationResponse response = buildClosedResponse(matchId, request.getUserId().toString());

                // 실패 이벤트 발행
                publishConfirmationEvent(request.getUserId(), matchId, request.getSeatIds(), null,
                        false, response.getMessage(), startTime);

                return response;
            }

            // 2. Redis에서 좌석 상태 확인
            List<String> requestedSeats = request.getSeatIds();
            Long userId = request.getUserId();

            for (String seatId : requestedSeats) {
                Optional<Long> ownerOpt = seatReservationRedisRepository.findOwner(matchId, seatId);

                // 좌석이 선점되지 않았거나 다른 사용자가 선점한 경우
                if (ownerOpt.isEmpty()) {
                    SeatConfirmationResponse response = buildErrorResponse("좌석 " + seatId + "는 선점되지 않았습니다.");

                    // 실패 이벤트 발행
                    publishConfirmationEvent(request.getUserId(), matchId, request.getSeatIds(), null,
                            false, response.getMessage(), startTime);

                    return response;
                }

                if (!ownerOpt.get().equals(userId)) {
                    SeatConfirmationResponse response = buildConflictResponse(matchId, userId.toString(), requestedSeats);

                    // 실패 이벤트 발행
                    publishConfirmationEvent(request.getUserId(), matchId, request.getSeatIds(), null,
                            false, response.getMessage(), startTime);

                    return response;
                }
            }

            // 3. 좌석이 유효하고 해당 사용자가 선점한 상태 → 확정 처리
            List<ConfirmedSeatDto> confirmedSeats = new ArrayList<>();
            List<String> sectionIds = new ArrayList<>();

            for (String seatId : requestedSeats) {
                SeatMetaService.SeatMeta meta = seatMetaService.resolve(matchId, seatId);

                confirmedSeats.add(ConfirmedSeatDto.builder()
                        .seatId(seatId)
                        .sectionId(meta.getSectionId())
                        .build());

                sectionIds.add(meta.getSectionId());
            }

            // 4. 성공 응답 생성
            SeatConfirmationResponse response = SeatConfirmationResponse.builder()
                    .success(true)
                    .message("예약 확정")
                    .confirmedSeats(confirmedSeats)
                    .matchId("match" + matchId)
                    .userId(userId.toString())
                    .build();

            // 5. Kafka로 이벤트 발행 (비동기)
            publishConfirmationEvent(userId, matchId, requestedSeats, sectionIds,
                    true, "예약 확정", startTime);

            return response;
        } catch (Exception e) {
            log.error("좌석 확정 중 오류 발생: {}", e.getMessage(), e);

            SeatConfirmationResponse response = buildErrorResponse("좌석 확정 처리 중 오류가 발생했습니다: " + e.getMessage());

            // 실패 이벤트 발행
            publishConfirmationEvent(request.getUserId(), matchId, request.getSeatIds(), null,
                    false, e.getMessage(), startTime);

            return response;
        }
    }

    /**
     * 좌석 확정 이벤트 발행 헬퍼 메서드
     */
    private void publishConfirmationEvent(
            Long userId,
            Long matchId,
            List<String> seatIds,
            List<String> sectionIds,
            boolean success,
            String message,
            long startTime) {

        long duration = System.currentTimeMillis() - startTime;

        eventPublisherService.publishSeatConfirmationEvent(
                userId,
                matchId,
                seatIds,
                sectionIds,
                success,
                message,
                duration);
    }

    private SeatConfirmationResponse buildErrorResponse(String message) {
        return SeatConfirmationResponse.builder()
                .success(false)
                .message(message)
                .build();
    }

    private SeatConfirmationResponse buildConflictResponse(Long matchId, String userId, List<String> requestedSeats) {
        return SeatConfirmationResponse.builder()
                .success(false)
                .message("이미 예약된 좌석이 포함되어 전체 예약에 실패했습니다.")
                .matchId("match" + matchId)
                .userId(userId)
                .requestedSeats(requestedSeats)
                .build();
    }

    private SeatConfirmationResponse buildClosedResponse(Long matchId, String userId) {
        return SeatConfirmationResponse.builder()
                .success(false)
                .message("이 이벤트는 더 이상 예매할 수 없습니다.")
                .matchId("match" + matchId)
                .status("CLOSED")
                .build();
    }
}