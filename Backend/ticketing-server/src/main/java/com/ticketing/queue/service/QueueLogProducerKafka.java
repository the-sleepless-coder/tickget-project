package com.ticketing.queue.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.KafkaTopic;
import com.ticketing.queue.DTO.QueueDTO;
import com.ticketing.queue.DTO.QueueLogDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ExecutionException;

import static com.ticketing.KafkaTopic.USER_LOG_QUEUE;

@Service
@RequiredArgsConstructor
public class QueueLogProducerKafka {
    // private final repository
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    // Test 시, 지정한 사용자 수 만큼 queue에 쌓는다.
    public List<Map<String, Object>> testingProducer(int playerNum) throws ExecutionException, InterruptedException {

        String topic = USER_LOG_QUEUE.getTopicName();

        List<Map<String, Object>> result = new ArrayList<>();
        long key = 1;
        for(int messageNum=0 ; messageNum < playerNum; messageNum++){
            // Key 값을 늘려주고, Value 값을 지정해준다.
            String userId = UUID.randomUUID().toString();
            String value = "Queue-"+userId;
            String keyString = String.valueOf(key);

            SendResult<String, Object> recordData = kafkaTemplate.send(topic, keyString, value).get();

            Map<String, Object> message = new HashMap<>();
            message.put("key", keyString);
            message.put("value", value);
            message.put("topic", topic);
            message.put("partition", recordData.getRecordMetadata().partition());
            message.put("offset", recordData.getRecordMetadata().offset());

            result.add(message);

            key++;
        }

        return result;
    }

    // 대기열 생성을 위한 요청을 보낸다.
    public Map<String, Object> queueProducer(QueueDTO userInfo) throws JsonProcessingException, ExecutionException, InterruptedException {
        /*
        * 이거 반드시 key값을 바꿔주야 해!
        * */
        String topic = USER_LOG_QUEUE.getTopicName();
        int key = 1;
        String keyString = String.valueOf(key);

        String jsonValue = mapper.writeValueAsString(userInfo);

        // KakfkaProducer -> Producer Record
        // Spring => Kafka Queue
        SendResult<String, Object> result = kafkaTemplate.send(topic, keyString, jsonValue).get();

        Map<String, Object> message = new HashMap<>();
        message.put("key", key);
        message.put("value", jsonValue);
        message.put("topic", topic);
        message.put("partition", result.getRecordMetadata().partition());
        message.put("offset", result.getRecordMetadata().offset());

        return message;
    }


    // 로그 기록용 실제 사용자 정보를 보낸다.
    public Map<String, Object> queueLogProducer(QueueLogDTO userInfo) throws ExecutionException, InterruptedException, JsonProcessingException {
        String topic = USER_LOG_QUEUE.getTopicName();
        /*
         * 이거 반드시 key값을 바꿔주야 해!
         * */
        // Key 값을 늘려주고, Value 값을 지정해준다.
        // 전체 키 값 어떻게 관리해주지 사람마다?
        // DTO -> JSON
        int key = 1;
        String keyString = String.valueOf(key);

        userInfo.setEventId(UUID.randomUUID().toString());
        String jsonValue = mapper.writeValueAsString(userInfo);

        SendResult<String, Object> recordData = kafkaTemplate.send(topic, keyString, jsonValue).get();

        Map<String, Object> message = new HashMap<>();
        message.put("key", keyString);
        message.put("value", jsonValue);
        message.put("topic", topic);
        message.put("partition", recordData.getRecordMetadata().partition());
        message.put("offset", recordData.getRecordMetadata().offset());

        return message;
    }




}
