package com.ticketing.queue.exception;

import com.ticketing.queue.DTO.response.ErrorResponseDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // Duplicate Match Found 예외 처리.
    @ExceptionHandler(DuplicateMatchFoundException.class)
    public ResponseEntity<?> handleDuplicateMatchFoundException(DuplicateMatchFoundException e){
        log.warn("More than 1 match found");
        ErrorResponseDTO response = ErrorResponseDTO.of(
                "MULTIPLE_MATCHES_FOUND"
                ,"방이 2개 이상 존재합니다" + e.getMessage()
        );

        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(response);
    }



}
