package com.ticketing.queue.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.ticketing.queue.DTO.QueueDTO;
import com.ticketing.queue.DTO.QueueLogDTO;
import com.ticketing.queue.service.QueueService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/ticketing")
public class QueueController {
    @Autowired
    QueueService service;


    @GetMapping("/test")
    public String testController(){
        return "Testing API";
    }

    // 부하 테스트용 API
    @PostMapping("/testQueue/{playerNum}")
    public ResponseEntity<?> testProducer(@PathVariable("playerNum") int playerNum) throws ExecutionException, InterruptedException {
        List<Map<String, Object>> result = service.testingProducer(playerNum);

        return ResponseEntity.ok(result);
    }

    // 예매 확인 시, 요청하는 API
    // 실제 사용자용 producer API, Log데이터 저장까지 이어짐.
    @PostMapping("/produceQueue")
    public ResponseEntity<?> kafkaQueueProducer(@RequestBody QueueDTO userQueue) throws ExecutionException, JsonProcessingException, InterruptedException {
        Map<String, Object> result = service.queueProducer(userQueue);

        return ResponseEntity.ok(result);
    }

    // Log 데이터 저장을 위한 API.
    @PostMapping("/produceQueueLog")
    public ResponseEntity<?> kafkaLogProducer(@RequestBody QueueLogDTO userData) throws ExecutionException, InterruptedException, JsonProcessingException {
        Map<String, Object> result = service.queueLogProducer(userData);

        return ResponseEntity.ok(result);
    }

    @PostMapping("/consumeQueue")
    public ResponseEntity<?> kafkaQueueConsumer() throws ExecutionException, InterruptedException {
        Properties props = new Properties();
        props.put("bootstrap.servers", "localhost:9092");
        props.put("group.id", "user-queue-group");

        // Kafka Consumer가 Cluster와 연결하기 위한 코드.
        KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props, new StringDeserializer(), new StringDeserializer());
        String topic = "user-queue";
        consumer.subscribe(List.of(topic));
        while(true){
            // Consumer Records를 통해, Subscribe하고 있는 Topic에 대한 새로운 메시지를 갖고온다.
            ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(10));
            if(records.isEmpty())
                continue;

            for(ConsumerRecord<String, String> record :records){
                if(record.key()!=null){
                    System.out.printf("partition=%d offset=%d key=%s value=%s%n",
                            record.partition(), record.offset(), record.key(), record.value());
                }
            }

        }


    }
}
