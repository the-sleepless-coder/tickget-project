package com.ticketing.seat.controller;

import com.ticketing.seat.dto.SeatReservationRequest;
import com.ticketing.seat.dto.SeatReservationResponse;
import com.ticketing.seat.exception.MatchClosedException;
import com.ticketing.seat.exception.MatchNotFoundException;
import com.ticketing.seat.exception.ReservationConflictException;
import com.ticketing.seat.exception.TooManySeatsRequestedException;
import com.ticketing.seat.service.SeatReservationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ticketing")
public class SeatController {

    private final SeatReservationService seatReservationService;

    /**
     * 좌석 선점(hold) API
     *
     * @param matchId 매치 ID
     * @param request 좌석 선점 요청 정보 (userId, seatIds)
     * @return 성공 시 선점된 좌석 정보, 실패 시 실패한 좌석 정보
     */
    @PostMapping("/matches/{matchId}/hold")
    public ResponseEntity<SeatReservationResponse> holdSeats(
            @PathVariable Long matchId,
            @RequestBody SeatReservationRequest request) {

        // matchId 설정
        request.setMatchId(matchId);

        try {
            // 좌석 예약 서비스 호출
            SeatReservationResponse response = seatReservationService.reserveSeats(request);

            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
            }

        } catch (MatchNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(buildErrorResponse("Match not found"));
        } catch (MatchClosedException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(buildErrorResponse("Match is closed or not available"));
        } catch (TooManySeatsRequestedException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(buildErrorResponse("Too many seats requested"));
        } catch (ReservationConflictException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(buildErrorResponse("Seat reservation conflict"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(buildErrorResponse("Internal server error: " + e.getMessage()));
        }
    }

    /**
     * 에러 응답 생성 헬퍼 메서드
     */
    private SeatReservationResponse buildErrorResponse(String message) {
        return SeatReservationResponse.builder()
                .success(false)
                .build();
    }
}