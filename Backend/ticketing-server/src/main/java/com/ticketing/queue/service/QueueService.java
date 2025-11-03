package com.ticketing.queue.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.KafkaTopic;
import com.ticketing.queue.DTO.QueueDTO;
import com.ticketing.queue.DTO.QueueLogDTO;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ExecutionException;

@Service
public class QueueService {
    // private final repository

    // Test 시, 지정한 사용자 수 만큼 queue에 쌓는다.
    public List<Map<String, Object>> testingProducer(int playerNum) throws ExecutionException, InterruptedException {
        Properties props = new Properties();
        props.put("bootstrap.servers", "localhost:9092");
        /*
         * props
         * Parameters config, key Serializer, value serializer
         *
         * Kafka Producer를 통해서, Cluster와의 연결 생성: 연결 주소, Key, Value Serializer
         * Producer Record를 통해서, topic, key, value/ timestamp, partition, headers 설정
         * Value는 DTO생성해서 보내면 된다.
         */
        KafkaProducer<String, String> producer = new KafkaProducer<>(props, new StringSerializer(), new StringSerializer());

        String topic = KafkaTopic.USER_QUEUE.getTopicName();

        List<Map<String, Object>> result = new ArrayList<>();
        int key = 1;
        for(int messageNum=0 ; messageNum < playerNum; messageNum++){
            // Key 값을 늘려주고, Value 값을 지정해준다.
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

        return result;
    }

    // 대기열 생성을 위한 요청을 보낸다.
    public Map<String, Object> queueProducer(QueueDTO userInfo){



        return null;
    }


    // 로그 기록용 실제 사용자 정보를 보낸다.
    public Map<String, Object> queueLogProducer(QueueLogDTO userInfo) throws ExecutionException, InterruptedException, JsonProcessingException {
        /*
         * props
         * Parameters config, key Serializer, value serializer
         *
         * Kafka Producer를 통해서, Cluster와의 연결 생성: 연결 주소, Key, Value Serializer
         * Producer Record를 통해서, topic, key, value/ timestamp, partition, headers 설정
         * Value는 DTO생성해서 보내면 된다.
         */
        Properties props = new Properties();
        props.put("bootstrap.servers", "localhost:9092");
        KafkaProducer<String, String> producer = new KafkaProducer<>(props, new StringSerializer(), new StringSerializer());

        String topic = KafkaTopic.USER_QUEUE.getTopicName();

        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        // Key 값을 늘려주고, Value 값을 지정해준다.
        // 전체 키 값 어떻게 관리해주지 사람마다?
        // DTO -> JSON
        int key = 1;
        String keyString = String.valueOf(key);
        QueueLogDTO dto = new QueueLogDTO(UUID.randomUUID().toString(), userInfo.getRoomId(),userInfo.getPlayerType(), userInfo.getPlayerId(), userInfo.getQueueRank(), userInfo.getClickMiss(), userInfo.getDuration());
        String jsonValue = mapper.writeValueAsString(dto);

        ProducerRecord<String, String> record = new ProducerRecord<>(topic, keyString, jsonValue);

        RecordMetadata meta = producer.send(record).get();

        Map<String, Object> message = new HashMap<>();
        message.put("key", keyString);
        message.put("value", jsonValue);
        message.put("topic", topic);
        message.put("partition", meta.partition());
        message.put("offset", meta.offset());

        producer.close();

        return message;
    }




}
