package com.ticketing.seat.controller;

import com.ticketing.seat.dto.SeatCancelResponse;
import com.ticketing.seat.exception.MatchNotFoundException;
import com.ticketing.seat.service.SeatCancelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/ticketing")
public class SeatCancelController {

    private final SeatCancelService seatCancelService;

    /**
     * 좌석 취소 API
     *
     * @param matchId 매치 ID
     * @param userId 사용자 ID (Query Parameter)
     * @return 취소 결과
     */
    @DeleteMapping("/matches/{matchId}/seats/cancel")
    public ResponseEntity<SeatCancelResponse> cancelSeats(
            @PathVariable Long matchId,
            @RequestParam Long userId) {

        log.info("좌석 취소 요청: matchId={}, userId={}", matchId, userId);

        try {
            SeatCancelResponse response = seatCancelService.cancelSeats(matchId, userId);

            if (response.isSuccess()) {
                log.info("좌석 취소 성공: matchId={}, userId={}, count={}",
                        matchId, userId, response.getCancelledSeatCount());
                return ResponseEntity.ok(response);
            } else {
                log.warn("좌석 취소 실패: matchId={}, userId={}, message={}",
                        matchId, userId, response.getMessage());

                // 메시지에 따라 상태 코드 결정
                if (response.getMessage().contains("이미 확정")) {
                    return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
                } else if (response.getMessage().contains("없습니다")) {
                    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
                } else {
                    return ResponseEntity.badRequest().body(response);
                }
            }

        } catch (MatchNotFoundException e) {
            log.warn("매치 없음: matchId={}", matchId);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(SeatCancelResponse.builder()
                            .success(false)
                            .message("Match not found: " + matchId)
                            .matchId(matchId)
                            .userId(userId)
                            .cancelledSeatCount(0)
                            .build());
        } catch (Exception e) {
            log.error("좌석 취소 처리 중 오류 발생: matchId={}", matchId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(SeatCancelResponse.builder()
                            .success(false)
                            .message("Internal server error: " + e.getMessage())
                            .matchId(matchId)
                            .userId(userId)
                            .cancelledSeatCount(0)
                            .build());
        }
    }
}