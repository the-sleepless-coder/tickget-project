package com.ticketing.queue.controller;

import com.ticketing.queue.service.QueueService;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;
import java.util.concurrent.ExecutionException;

import static org.springframework.core.io.support.PropertiesLoaderUtils.loadProperties;

@RestController
@RequestMapping("/api/ticketing")
public class QueueController {
    @Autowired
    QueueService service;

    @GetMapping("/test")
    public String testController(){

        return "Testing API";
    }

    @PostMapping("/reserve")
    public ResponseEntity<?> kafkaReserveProducer() throws ExecutionException, InterruptedException {
        // #1 Producer Class
        // Properties config = loadProperties("kafka.properties");
        // Producer<Long, String> producer1 = new KafkaProducer<>(config);

        // #2 kafkaTemplate
        // kafkaTemplate.send("ticket-reserve", "Reservation reqeust successfully finished");

        Properties props = new Properties();
        props.put("bootstrap.servers", "localhost:9092");
        // props.put("key.serializer", "org.apache.kafka.common.serialization.StringSerializer");
        // props.put("value.serializer", "org.apache.kafka.common.serialization.StringSerializer");
         /*
          * props
          * Parameters config, key Serializer, value serializer
          *
          * Kafka Producer를 통해서, Cluster와의 연결 생성: 연결 주소, Key, Value Serializer
          * Producer Record를 통해서, topic, key, value/ timestamp, partition, headers 설정
          * Value는 DTO생성해서 보내면 된다.
          *
          * 동일 Broker 내 -> Partition 개수 늘리기
          * 하나의 Broker로 작동하면, 다른 Broker 추가
          */

         KafkaProducer<String, String> producer = new KafkaProducer<>(props, new StringSerializer(), new StringSerializer());
         System.out.println(producer.toString());

         String topic = "user-queue";
         int N = 10;
         int key = 1;

         List<Map<String, Object>> result = new ArrayList<>();
         for(int i=0 ; i < N; i++){
             // Key 값을 늘려주고, Value+Key 값을 지정해준다.
             String value = "Wait-Queue" + key;
             String keyString = String.valueOf(key);
             ProducerRecord<String, String> record = new ProducerRecord<>(topic, keyString, value);

             RecordMetadata meta = producer.send(record).get();

             Map<String, Object> message = new HashMap<>();
             message.put("key", keyString);
             message.put("value", value);
             message.put("topic", topic);
             message.put("partition", meta.partition());
             message.put("offset", meta.offset());

             result.add(message);

             key++;
         }

         producer.close();

         return ResponseEntity.ok(result);

    }

}
