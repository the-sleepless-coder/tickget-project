package com.ticketing.queue.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.ticketing.queue.DTO.*;
import com.ticketing.queue.DTO.request.MatchRequestDTO;
import com.ticketing.queue.DTO.response.MatchIdResponseDTO;
import com.ticketing.queue.DTO.response.MatchResponseDTO;
import com.ticketing.queue.service.QueueLogProducerKafka;
import com.ticketing.queue.service.QueueService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.ExecutionException;

@Slf4j
@RestController
@RequestMapping("/ticketing")
@Tag(name = "Queue", description = "Queue 관련 API")
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
    public ResponseEntity<?> enterQueue(@PathVariable Long matchId, HttpServletRequest request, @RequestBody QueueUserInfoDTO dto) throws ExecutionException, InterruptedException {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        QueueDTO result = service.enqueue(matchId, userId, dto);
        return ResponseEntity.ok(result);
    }


    @PostMapping("/matches")
    @Operation(
            summary = "경기 시작 시, DB, Kafka, Redis, 다른 서버에 요청 등 관련 데이터 처리",
            description = "새로운 경기 데이터를 생성하여 경기 관련 처리를 한다."
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "매치 생성 성공"),
            @ApiResponse(responseCode = "400", description = "매치 데이터 생성 실패")
    })
    public ResponseEntity<?> startMatchController(@RequestBody MatchRequestDTO dto){
        MatchResponseDTO match = service.startMatch(dto);

        // 매치 생성 실패
        if(match==null){
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", " 매치 데이터 생성 실패"));
        }

        // 매치 생성 성공
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(match);
    }

    // WAITING 상태의 roomId에 대한 match 정보 불러오기
    @GetMapping("/matches/{roomId}")
    public ResponseEntity<?> getMatchDBData(@PathVariable Long roomId){

        MatchIdResponseDTO res = service.getMatchData(roomId);

        return ResponseEntity.ok(res);
    }

}
