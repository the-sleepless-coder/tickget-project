package com.ticketing;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@RequestMapping("/health")
@RestController
public class HealthController {

    @GetMapping()
    public ResponseEntity<Map<String, String>> healthCheck() {
        long startTime = System.currentTimeMillis();

        Map<String, String> response = new HashMap<>();
        response.put("status", "UP");
        response.put("timestamp", LocalDateTime.now().toString());

        long processingTime = System.currentTimeMillis() - startTime;
        response.put("serverProcessingTime", processingTime + "ms");

        return ResponseEntity.ok(response);
    }
}
