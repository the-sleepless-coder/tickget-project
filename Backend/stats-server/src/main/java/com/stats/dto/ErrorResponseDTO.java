package com.stats.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ErrorResponseDTO {
    private String code;
    private String message;
    private LocalDateTime timeStamp;

    public static ErrorResponseDTO dtobuilder(String code, String message, LocalDateTime ts){
        return ErrorResponseDTO.builder()
                .code(code)
                .message(message)
                .timeStamp(ts)
                .build();
    }

}
