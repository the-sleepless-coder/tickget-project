package com.ticketing.queue.DTO.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.web.ErrorResponse;

import java.time.LocalDateTime;

// 정형화된 ErrorDTO를 만들어준다.
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ErrorResponseDTO {
    private String code;
    private String message;
    private LocalDateTime timeStamp;

    public static ErrorResponseDTO of(String code, String message){
        // Builder는 그냥 쉽게 새로운 객체 만드는 방법임.ㅋ
        return ErrorResponseDTO.builder()
                .code(code)
                .message(message)
                .timeStamp(LocalDateTime.now())
                .build();
    }

}
