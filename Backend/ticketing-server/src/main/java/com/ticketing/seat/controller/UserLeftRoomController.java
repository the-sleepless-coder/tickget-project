package com.ticketing.seat.controller;

import com.ticketing.seat.dto.UserLeftRoomResponse;
import com.ticketing.seat.service.UserLeftRoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 경기 중간 퇴장 유저 알림 컨트롤러
 *
 * Room Server에서 호출하는 내부 API
 * 경기 진행 중에 유저가 방을 나갔을 때 미확정 좌석을 취소 처리
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/ticketing")
public class UserLeftRoomController {

    private final UserLeftRoomService userLeftRoomService;

    /**
     * 경기 중간 퇴장 유저 알림 API
     *
     * @param roomId 방 ID (Path Parameter)
     * @param userId 유저 ID (Path Parameter)
     * @return 처리 결과 (취소된 좌석 수, 상태 변경 여부 등)
     */
    @PostMapping("/rooms/{roomId}/users/{userId}")
    public ResponseEntity<UserLeftRoomResponse> notifyUserLeftRoom(
            @PathVariable Long roomId,
            @PathVariable Long userId) {

        log.info("경기 중 유저 퇴장 알림 수신: roomId={}, userId={}", roomId, userId);

        try {
            UserLeftRoomResponse response = userLeftRoomService.handleUserLeftRoom(roomId, userId);

            if (response.isSuccess()) {
                log.info("유저 퇴장 처리 성공: roomId={}, userId={}, cancelledSeats={}, statusChanged={}",
                        roomId, userId, response.getCancelledSeatCount(), response.isStatusChangedToOpen());
                return ResponseEntity.ok(response);
            } else {
                log.warn("유저 퇴장 처리 실패: roomId={}, userId={}, message={}",
                        roomId, userId, response.getMessage());
                return ResponseEntity.badRequest().body(response);
            }

        } catch (Exception e) {
            log.error("유저 퇴장 알림 처리 중 예외 발생: roomId={}, userId={}, error={}",
                    roomId, userId, e.getMessage(), e);

            UserLeftRoomResponse errorResponse = UserLeftRoomResponse.builder()
                    .success(false)
                    .message("Internal server error: " + e.getMessage())
                    .matchId(null)
                    .userId(userId)
                    .cancelledSeatCount(0)
                    .statusChangedToOpen(false)
                    .build();

            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
}