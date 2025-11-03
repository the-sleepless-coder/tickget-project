package com.ticketing.queue.service;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
public class QueueConsumer {

    @KafkaListener(id="userQueueListener",
    topics = "user-queue",
    concurrency="3",
    groupId = "user-queue-group"
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


        Thread.sleep(1000);

        ack.acknowledge();

    }

}
