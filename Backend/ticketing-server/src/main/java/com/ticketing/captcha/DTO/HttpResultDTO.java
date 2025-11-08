package com.ticketing.captcha.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class HttpResultDTO {
    private int status;
    private String body;
    private Map<String, List<String>> headers;
}
