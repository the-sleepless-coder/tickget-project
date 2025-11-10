package com.ticketing.queue.service;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Service;

@Service
public class QueueLogConsumer {
    @KafkaListener(id="userLogListener",
    topics = "user-log",
    concurrency="3",
    groupId = "user-log-group"
    )
    public void onMessage(ConsumerRecord<String, String> record, Acknowledgment ack) throws InterruptedException {
        if(record.key()==null){
            ack.acknowledge();
            return;
        }

        // 대기열 속도를 Redis에 Lock을 잡을 수 있는만큼만 줄 세우고,
        // 빠져나가는 인원수만큼 추가해준다.
        System.out.printf("topic=%s, key=%s, partition=%d, offset=%d, value=%s \n",
                record.topic(),
                record.key(),
                record.partition(),
                record.offset(),
                record.value()
        );



        // offset에 대한 수동 커밋을 해준다.
        // DLT관리를 위한 수동 커밋.
        ack.acknowledge();

    }

}
