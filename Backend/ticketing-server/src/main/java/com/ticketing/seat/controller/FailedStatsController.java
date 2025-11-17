package com.ticketing.seat.controller;

import com.ticketing.seat.dto.FailedStatsRequest;
import com.ticketing.seat.dto.FailedStatsResponse;
import com.ticketing.seat.exception.MatchNotFoundException;
import com.ticketing.seat.service.FailedStatsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 예매 실패 사용자 통계 저장 API
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/ticketing")
public class FailedStatsController {

    private final FailedStatsService failedStatsService;

    /**
     * 예매 실패 사용자 통계 저장
     *
     * @param matchId 매치 ID
     * @param request 실패 통계 요청
     * @return 성공 여부
     */
    @PostMapping("/matches/{matchId}/stats/failed")
    public ResponseEntity<FailedStatsResponse> saveFailedStats(
            @PathVariable Long matchId,
            @RequestBody FailedStatsRequest request) {

        log.info("예매 실패 통계 저장 요청: matchId={}, userId={}", matchId, request.getUserId());

        try {
            FailedStatsResponse response = failedStatsService.saveFailedStats(matchId, request);

            if (response.getSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }

        } catch (MatchNotFoundException e) {
            log.warn("매치 없음: matchId={}", matchId);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(FailedStatsResponse.builder()
                            .success(false)
                            .build());

        } catch (Exception e) {
            log.error("예매 실패 통계 저장 중 오류 발생: matchId={}", matchId, e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(FailedStatsResponse.builder()
                            .success(false)
                            .build());
        }
    }
}