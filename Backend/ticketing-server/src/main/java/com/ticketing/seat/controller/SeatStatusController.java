package com.ticketing.seat.controller;

import com.ticketing.seat.dto.SeatStatusResponse;
import com.ticketing.seat.exception.MatchClosedException;
import com.ticketing.seat.exception.MatchNotFoundException;
import com.ticketing.seat.service.SeatStatusService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/ticketing")
public class SeatStatusController {

    private final SeatStatusService seatStatusService;

    /**
     * 섹션 내 선점된 좌석 상태 조회 API
     *
     * @param matchId 경기 ID
     * @param sectionId 섹션 ID
     * @param userId 사용자 ID (쿼리 파라미터)
     * @return 선점된 좌석만 반환 (프론트가 나머지는 AVAILABLE로 판단)
     */
    @GetMapping("/matches/{matchId}/sections/{sectionId}/seats/status")
    public ResponseEntity<?> getSeatStatus(
            @PathVariable Long matchId,
            @PathVariable String sectionId,
            @RequestParam Long userId) {

        try {
            log.info("좌석 상태 조회: matchId={}, sectionId={}, userId={}",
                    matchId, sectionId, userId);

            SeatStatusResponse response = seatStatusService.getSeatStatus(
                    matchId, sectionId, userId);

            log.info("선점된 좌석 수: {}", response.getSeats().size());

            return ResponseEntity.ok(response);

        } catch (MatchNotFoundException e) {
            log.warn("매치 없음: matchId={}", matchId);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of(
                            "error", "Match not found",
                            "matchId", matchId
                    ));
        } catch (MatchClosedException e) {
            log.warn("매치 닫힘: matchId={}", matchId);
            return ResponseEntity.status(HttpStatus.GONE)
                    .body(Map.of(
                            "error", "Match is closed",
                            "matchId", matchId
                    ));
        } catch (Exception e) {
            log.error("좌석 상태 조회 중 오류 발생: matchId={}, sectionId={}", matchId, sectionId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal server error: " + e.getMessage()));
        }
    }
}