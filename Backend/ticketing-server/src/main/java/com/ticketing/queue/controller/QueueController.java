package com.ticketing.queue.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.ticketing.queue.DTO.MatchRequestDTO;
import com.ticketing.queue.DTO.QueueDTO;
import com.ticketing.queue.DTO.QueueLogDTO;
import com.ticketing.queue.DTO.QueueUserInfoDTO;
import com.ticketing.queue.service.QueueLogProducerKafka;
import com.ticketing.queue.service.QueueService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/ticketing")
public class QueueController {
    @Autowired
    QueueLogProducerKafka producerService;

    @Autowired
    QueueService service;

    @GetMapping("/test")
    public String testController(){
        return "Testing API";
    }

    // 부하 테스트용 API
    @PostMapping("/testQueue/{playerNum}")
    public ResponseEntity<?> testProducer(@PathVariable("playerNum") int playerNum) throws ExecutionException, InterruptedException {
        List<Map<String, Object>> result = producerService.testingProducer(playerNum);

        return ResponseEntity.ok(result);
    }

    // 예매 확인 시, 요청하는 API
    // 실제 사용자용 producer API, Log데이터 저장까지 이어짐.
    @PostMapping("/produceQueue")
    public ResponseEntity<?> kafkaQueueProducer(@RequestBody QueueDTO userQueue) throws ExecutionException, JsonProcessingException, InterruptedException {
        Map<String, Object> result = producerService.queueProducer(userQueue);

        return ResponseEntity.ok(result);
    }

    // Log 데이터 저장을 위한 API.
    @PostMapping("/produceQueueLog")
    public ResponseEntity<?> kafkaLogProducer(@RequestBody QueueLogDTO userData) throws ExecutionException, InterruptedException, JsonProcessingException {
        Map<String, Object> result = producerService.queueLogProducer(userData);

        return ResponseEntity.ok(result);
    }

    // 사용자 Enqueue하는 API
    @PostMapping("/queue/{matchId}")
    public ResponseEntity<?> enterQueue(@PathVariable Long matchId, HttpServletRequest request, @RequestBody QueueUserInfoDTO dto){
        Long userId = Long.valueOf(request.getHeader("userId"));
        QueueDTO result = service.enqueue(matchId, userId, dto);
        return ResponseEntity.ok(result);
    }

    // 경기 시작 시, 경기 관련 데이터를 생성하는 API
    @PostMapping("/matches")
    public ResponseEntity<?> createDBData(@RequestBody MatchRequestDTO dto){
        try{
            int res = service.insertMatchData(dto);
            if(res==1){
                return ResponseEntity.status(HttpStatus.CREATED)
                        .body(Map.of("message","매치 데이터 생성 성공"));
            }else{
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("message", "매치 데이터 생성 실패"));
            }
        }catch(Exception e){
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }

    }


}
