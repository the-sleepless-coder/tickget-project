package com.ticketing.queue.service;

import com.ticketing.KafkaTopic;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.ExecutionException;


@Service
public class QueuePositionWriter {
    /*
    private final QueuePosition lagService;
    // private final StringRedisTemplate redis;

    public QueuePositionWriter(QueuePosition lagService){
        this.lagService = lagService;
    }

    @Scheduled(fixedRate=1000)
    public void printUserQueueLag() throws ExecutionException, InterruptedException {
        try{
            long remaining = lagService.getTotalLag(KafkaTopic.USER_QUEUE.getTopicName(), KafkaTopic.USER_QUEUE_GROUP.getTopicName());
            System.out.printf("[Remaining] Total remaining seats: %d\n", remaining);

//            String redisKey = KEY + topic;
//            String old = redis.opsForValue().get(redisKey);
//            if (old == null || !old.equals(Long.toString(newLag))) {
//                // 값이 바뀐 경우에만 기록 (로그/쓰기 줄이기)
//                redis.opsForValue().set(redisKey, Long.toString(newLag), Duration.ofSeconds(3));
//                System.out.printf("[Remaining] Total remaining seats: %d%n", newLag);
//            }



        }catch(Exception e){
            System.err.println("[Warning] Redis에 남는 좌석 수를 기록하지 못했습니다." + e.getMessage());
            e.printStackTrace();
        }


    }
    */
}
