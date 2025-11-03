package com.example.testserver.controller;

import com.example.testserver.mongo.MongoTestDocument;
import com.example.testserver.mongo.MongoTestRepository;
import com.example.testserver.mysql.MySqlTestEntity;
import com.example.testserver.mysql.MySqlTestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*; // GetMapping, RequestMapping 등 import

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RequestMapping("test")
@RestController // @RestControllerAdvice -> @RestController로 변경
@RequiredArgsConstructor // Repository 주입을 위한 생성자 자동 생성
public class TestController {

    // --- [추가] 각 Repository 및 Template 주입 ---
    private final MySqlTestRepository mySqlTestRepository;
    private final MongoTestRepository mongoTestRepository;
    private final StringRedisTemplate stringRedisTemplate; // 간단한 문자열 테스트용

    @GetMapping()
    public ResponseEntity<Map<String, String>> test() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "UP");
        response.put("timestamp", LocalDateTime.now().toString());
        return ResponseEntity.ok(response);
    }

    // ======== 1. MySQL 테스트 엔드포인트 ========

    @PostMapping("/mysql")
    public ResponseEntity<MySqlTestEntity> createMySqlTest(@RequestParam String name) {
        MySqlTestEntity entity = new MySqlTestEntity(name);
        MySqlTestEntity savedEntity = mySqlTestRepository.save(entity);
        log.info("MySQL Save: {}", savedEntity);
        return ResponseEntity.ok(savedEntity);
    }

    @GetMapping("/mysql/{id}")
    public ResponseEntity<MySqlTestEntity> getMySqlTest(@PathVariable Long id) {
        Optional<MySqlTestEntity> entity = mySqlTestRepository.findById(id);
        return ResponseEntity.of(entity);
    }

    // ======== 2. MongoDB 테스트 엔드포인트 ========

    @PostMapping("/mongo")
    public ResponseEntity<MongoTestDocument> createMongoTest(@RequestParam String description) {
        MongoTestDocument doc = new MongoTestDocument(description);
        MongoTestDocument savedDoc = mongoTestRepository.save(doc);
        log.info("MongoDB Save: {}", savedDoc);
        return ResponseEntity.ok(savedDoc);
    }

    @GetMapping("/mongo/{id}")
    public ResponseEntity<MongoTestDocument> getMongoTest(@PathVariable String id) {
        Optional<MongoTestDocument> doc = mongoTestRepository.findById(id);
        return ResponseEntity.of(doc);
    }

    // ======== 3. Redis 테스트 엔드포인트 ========
    // (경고: 쿠버네티스 배포 후 테스트 가능)

    @PostMapping("/redis")
    public ResponseEntity<String> createRedisTest(@RequestParam String key, @RequestParam String value) {
        try {
            stringRedisTemplate.opsForValue().set(key, value);
            log.info("Redis Save: key={}, value={}", key, value);
            return ResponseEntity.ok("Saved: " + key + " = " + value);
        } catch (Exception e) {
            log.error("Redis Error: {}", e.getMessage());
            return ResponseEntity.internalServerError().body("Redis Error: " + e.getMessage());
        }
    }

    @GetMapping("/redis/{key}")
    public ResponseEntity<String> getRedisTest(@PathVariable String key) {
        try {
            String value = stringRedisTemplate.opsForValue().get(key);
            return ResponseEntity.ok("Found: " + key + " = " + value);
        } catch (Exception e) {
            log.error("Redis Error: {}", e.getMessage());
            return ResponseEntity.internalServerError().body("Redis Error: " + e.getMessage());
        }
    }
}