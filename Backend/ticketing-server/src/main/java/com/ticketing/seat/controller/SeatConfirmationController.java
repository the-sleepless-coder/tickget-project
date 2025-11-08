package com.ticketing.seat.controller;

import com.ticketing.seat.dto.SeatConfirmationRequest;
import com.ticketing.seat.dto.SeatConfirmationResponse;
import com.ticketing.seat.exception.MatchClosedException;
import com.ticketing.seat.exception.MatchNotFoundException;
import com.ticketing.seat.exception.SeatAlreadyTakenException;
import com.ticketing.seat.service.SeatConfirmationService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ticketing")
public class SeatConfirmationController {

    private final SeatConfirmationService seatConfirmationService;

    /**
     * 좌석 확정 API
     *
     * @param matchId 매치 ID
     * @param request 확정 요청 정보 (userId, 통계 데이터)
     * @return 확정 결과
     */
    @PostMapping("/matches/{matchId}/seats/confirm")
    public ResponseEntity<SeatConfirmationResponse> confirmSeats(
            @PathVariable Long matchId,
            @RequestBody SeatConfirmationRequest request,
            HttpServletRequest servletRequest) {

        log.info("좌석 확정 요청: matchId={}, userId={}", matchId, request.getUserId());

        try {
            // 좌석 확정 서비스 호출
            SeatConfirmationResponse response = seatConfirmationService.confirmSeats(matchId, request);

            // 응답 상태 결정
            if (!response.isSuccess()) {
                // 이미 예약된 좌석 충돌
                if (response.getMessage() != null && response.getMessage().contains("이미 예약된 좌석")) {
                    log.warn("좌석 충돌 발생: matchId={}, userId={}", matchId, request.getUserId());
                    return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
                }

                // 판매 종료 / 매치 종료
                if (response.getMessage() != null && response.getMessage().contains("더 이상 예매할 수 없습니다")) {
                    log.warn("매치 종료됨: matchId={}, userId={}", matchId, request.getUserId());
                    return ResponseEntity.status(HttpStatus.GONE).body(response);
                }

                // 기타 오류
                log.warn("좌석 확정 실패: matchId={}, userId={}, message={}",
                        matchId, request.getUserId(), response.getMessage());
                return ResponseEntity.badRequest().body(response);
            }

            // 성공 응답
            log.info("좌석 확정 성공: matchId={}, userId={}, userRank={}, 확정 좌석 수={}",
                    matchId, request.getUserId(), response.getUserRank(),
                    response.getConfirmedSeats() != null ? response.getConfirmedSeats().size() : 0);
            return ResponseEntity.ok(response);

        } catch (MatchNotFoundException e) {
            log.warn("매치 없음: matchId={}", matchId);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(buildErrorResponse("Match not found: " + matchId));
        } catch (MatchClosedException e) {
            log.warn("매치 닫힘: matchId={}", matchId);
            return ResponseEntity.status(HttpStatus.GONE)
                    .body(buildErrorResponse(e.getMessage()));
        } catch (SeatAlreadyTakenException e) {
            log.warn("좌석 이미 점유됨: matchId={}, message={}", matchId, e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(buildErrorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("좌석 확정 처리 중 오류 발생: matchId={}", matchId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(buildErrorResponse("Internal server error: " + e.getMessage()));
        }
    }

    /**
     * 에러 응답 생성 헬퍼 메서드
     */
    private SeatConfirmationResponse buildErrorResponse(String message) {
        return SeatConfirmationResponse.builder()
                .success(false)
                .message(message)
                .build();
    }
}