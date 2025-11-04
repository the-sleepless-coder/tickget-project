package com.tickget.roomserver.exception;

import com.tickget.roomserver.dto.response.ErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // ===== 4xx 에러: 구체적인 메시지 제공 =====
    @ExceptionHandler(RoomNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleRoomNotFoundException(RoomNotFoundException e) {
        log.warn("Room not found: {}", e.getMessage());
        ErrorResponse response = ErrorResponse.of(
                "ROOM_NOT_FOUND",
                "존재하지 않는 방입니다. (Room ID: " + e.getMessage() + ")"
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(PresetHallNotFoundException.class)
    public ResponseEntity<ErrorResponse> handlePresetHallNotFoundException(PresetHallNotFoundException e) {
        log.warn("Preset hall not found: {}", e.getMessage());
        ErrorResponse response = ErrorResponse.of(
                "PRESET_HALL_NOT_FOUND",
                "존재하지 않는 홀입니다. (Hall ID: " + e.getMessage() + ")"
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(RoomFullException.class)
    public ResponseEntity<ErrorResponse> handleRoomFullException(RoomFullException e) {
        log.warn("Room is full: {}", e.getMessage());
        ErrorResponse response = ErrorResponse.of(
                "ROOM_FULL",
                e.getMessage()
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(RoomClosedException.class)
    public ResponseEntity<ErrorResponse> handleRoomClosedException(RoomClosedException e) {
        log.warn("Room is closed: {}", e.getMessage());
        ErrorResponse response = ErrorResponse.of(
                "ROOM_CLOSED",
                e.getMessage()
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(RoomPlayingException.class)
    public ResponseEntity<ErrorResponse> handleRoomPlatingException(RoomPlayingException e) {
        log.warn("Room Playing: {}", e.getMessage());
        ErrorResponse response = ErrorResponse.of(
                "ROOM_PLAYING",
                e.getMessage()
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(InvalidRoomSettingsException.class)
    public ResponseEntity<ErrorResponse> handleInvalidRoomSettingsException(InvalidRoomSettingsException e) {
        log.warn("Invalid room settings: {}", e.getMessage());
        ErrorResponse response = ErrorResponse.of(
                "INVALID_ROOM_SETTINGS",
                e.getMessage()
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ErrorResponse> handleUnauthorizedException(UnauthorizedException e) {
        log.warn("Unauthorized access: {}", e.getMessage());
        ErrorResponse response = ErrorResponse.of(
                "UNAUTHORIZED",
                e.getMessage()
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgumentException(IllegalArgumentException e) {
        log.warn("Invalid argument: {}", e.getMessage());
        ErrorResponse response = ErrorResponse.of(
                "BAD_REQUEST",
                e.getMessage()
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    // ===== 5xx 에러: 일반 메시지만 제공 =====

    @ExceptionHandler(ImageUploadException.class)
    public ResponseEntity<ErrorResponse> handleImageUploadException(ImageUploadException e) {
        log.error("Image upload failed", e);
        ErrorResponse response = ErrorResponse.of(
                "IMAGE_UPLOAD_ERROR",
                "이미지 업로드에 실패했습니다. 잠시 후 다시 시도해주세요."
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception e) {
        log.error("Unexpected exception occurred", e);
        ErrorResponse response = ErrorResponse.of(
                "INTERNAL_SERVER_ERROR",
                "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
}
