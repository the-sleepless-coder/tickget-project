package com.ticketing.queue.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.queue.DTO.QueueLogDTO;
import lombok.RequiredArgsConstructor;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Service;
/**
@Service
@RequiredArgsConstructor
public class QueueLogConsumer {
    private final ObjectMapper mapper;


    @KafkaListener(id="userLogListener",
    topics = "user-log",
    concurrency="3",
    groupId = "user-log-group"
    )
    public void onMessage(ConsumerRecord<String, QueueLogDTO> record, Acknowledgment ack) throws InterruptedException, JsonProcessingException {
        if(record.key()==null){
            ack.acknowledge();
            return;
        }

        try{
            QueueLogDTO dto = record.value();
            String serialized = mapper.writeValueAsString(dto);

            System.out.printf("topic=%s, key=%s, partition=%d, offset=%d, value=%s \n",
                    record.topic(),
                    record.key(),
                    record.partition(),
                    record.offset(),
                    serialized
            );

        }catch(Exception e){
            e.getMessage();
        }

        // offset에 대한 수동 커밋을 해준다.
        // DLT관리를 위한 수동 커밋.
        ack.acknowledge();

    }

}
*/