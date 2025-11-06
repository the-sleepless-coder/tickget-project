package com.ticketing.captcha.controller;

import com.ticketing.captcha.DTO.CaptchaDTO;
import com.ticketing.captcha.DTO.HttpResultDTO;
import com.ticketing.captcha.service.CaptchaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/ticketing")
public class CaptchaController {
    @Autowired
    CaptchaService service;

    /**
     * user 인증 기능 구현 후, Authorization에서 토큰 꺼내서 쓸 것.
     * */
    // Captcha 문자열을 입력했을 때의 응답을 받는다.
    @PostMapping("/captcha/validate")
    public ResponseEntity<?> validateCaptcha(@RequestBody CaptchaDTO userInput) throws IOException {
        HttpResultDTO res = service.validateCaptcha(userInput);

        return ResponseEntity.status(res.getStatus())
                .contentType(MediaType.APPLICATION_JSON)
                .body(res.getBody())
                ;
    }

    /**
     * 인증된 사용자만 요청 보낼 수 있게 한다.
     * 토큰 발급 가능 시 -> Authorization 이용
     * */
    // 사용자에게 보여줄 CaptchaId를 base64인코딩된 값을 가져온다.
    @PostMapping("/captcha/request")
    public ResponseEntity<?> getCaptcha(@RequestBody Map<String, String> body) throws IOException {
        String userId= body.get("userId");
        Map<String, String> result = service.getCaptcha(userId);

        return ResponseEntity.ok(result);
    }
}
