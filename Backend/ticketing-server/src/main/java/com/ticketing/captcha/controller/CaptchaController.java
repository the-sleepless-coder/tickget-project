package com.ticketing.captcha.controller;

import com.ticketing.captcha.DTO.CaptchaDTO;
import com.ticketing.captcha.DTO.HttpResultDTO;
import com.ticketing.captcha.service.CaptchaService;
import jakarta.servlet.http.HttpServletRequest;
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
     * 인증된 사용자만 요청 보낼 수 있게 한다.
     * Authorization에서 인증된 사용자에게 Header에 담아보낸 userId를 이용해서,
     * Captcha 서버에 요청을 보낸다.
     * */
    // Captcha 문자열을 입력했을 때의 응답을 받는다.
    @PostMapping("/captcha/validate")
    public ResponseEntity<?> validateCaptcha(@RequestBody CaptchaDTO userInput, HttpServletRequest request) throws IOException {
        Long userId = Long.valueOf(request.getHeader("userId"));
        HttpResultDTO res = service.validateCaptcha(userInput, userId);

        return ResponseEntity.status(res.getStatus())
                .contentType(MediaType.APPLICATION_JSON)
                .body(res.getBody())
                ;
    }

    // 사용자에게 보여줄 CaptchaId를 base64인코딩된 값을 가져온다.
    @PostMapping("/captcha/request")
    public ResponseEntity<?> getCaptcha() throws IOException {
        Map<String, String> result = service.getCaptcha();

        return ResponseEntity.ok(result);
    }

    // 봇일 경우를 확인하는 API
    /**
     * 나중에 Filter 단에서 처리해서 서버에 대한 부담을 줄인다.
     * */
    @GetMapping()
    public ResponseEntity<?> validateRobot(HttpServletRequest request){
        // request.getHeader("userId");

        return null;
    }


}
