package com.ticketing.queue.Kafka;

import com.ticketing.queue.DTO.QueueLogDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Service;


@Slf4j
@Service
@RequiredArgsConstructor
public class KakfaLogConsumer {
    private final MongoTemplate mongoTemplate;

    @KafkaListener(id="userLogListener",
            topics = "user-log",
            concurrency="3",
            groupId = "user-log-group"
    )
    public void onMessage(ConsumerRecord<String, QueueLogDTO> record, Acknowledgment ack) throws InterruptedException {
        if(record.key()==null){
            ack.acknowledge();
            return;
        }

        try{
            /**
             * 배치 단위로 적재
             * */
            QueueLogDTO dto = record.value();

            // ✅ MongoDB에 그대로 적재 (컬렉션 이름: user_log)
            mongoTemplate.save(dto, "user_log");

            // log.info("MongoDB에 user-log 적재");

            // 성공 시에만 offset에 대한 수동 커밋을 해준다.
            // 성공을 하지 못할 시에는 user-log DLT 토픽에 넣어준다.
            ack.acknowledge();

        }catch(Exception e){
            log.error(" user-log 처리 실패  topic={}, key={}, partition={}, offset={}",
                    record.topic(), record.key(), record.partition(), record.offset(), e);

            //throw e; // DLT처리 로직.
        }finally{

        }


    }
}
