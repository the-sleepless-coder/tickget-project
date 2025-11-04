package com.ticketing.queue.service;

import com.google.common.util.concurrent.RateLimiter;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
public class QueueConsumerKafka {
    private final RateLimiter limiter = RateLimiter.create(2.0);

    private int messageCount = 1;
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

        // 초기 로직은 10개의 메시지만 대기열에서 빠져나갈 수 있게 한다.

        // (추가)redis-key를 읽어서 Lock으로 잡혀 있는 개수가 차감되면,
        // Queue에서 빼내는 로직을 구현한다.
        limiter.acquire();


        // 대기열 속도를 Redis에 Lock을 잡을 수 있는만큼만 줄 세우고,
        // 빠져나가는 인원수만큼 추가해준다.
        System.out.printf("topic=%s, key=%s, partition=%d, offset=%d, value=%s \n",
                record.topic(),
                record.key(),
                record.partition(),
                record.offset(),
                record.value()
        );

        messageCount ++;
        if(messageCount % 10==1){
            System.out.printf("----second = %d ---- \n", messageCount/10);
        }

        // offset에 대한 수동 커밋을 해준다.
        ack.acknowledge();

    }

}
