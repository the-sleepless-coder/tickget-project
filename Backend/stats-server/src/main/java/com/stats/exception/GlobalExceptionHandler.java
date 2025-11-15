package com.stats.exception;

import com.stats.dto.ErrorResponseDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {
    // RoomTypeException에 대한 예외 처리
    @ExceptionHandler(RoomTypeException.class)
    public ResponseEntity<?> handleRoomTypeException(RoomTypeException e){
        log.warn("Undefined Room Type");
        ErrorResponseDTO response = ErrorResponseDTO.dtobuilder("UNDEFINED_ROOM_TYPE"
                , "방 유형이 잘못됐습니다."
                , LocalDateTime.now());

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(response);
    }
}
