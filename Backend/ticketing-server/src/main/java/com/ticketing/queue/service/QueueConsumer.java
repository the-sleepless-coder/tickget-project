package com.ticketing.queue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.KafkaTopic;
import com.ticketing.queue.QueueKeys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.Set;

/**
@Service
@Slf4j
@RequiredArgsConstructor
public class QueueConsumer {

    private final StringRedisTemplate redis;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper mapper;

    private static final int CONSUME_RATE = 1;
    private static final String DEQUEUED = "DEQUEUED";

    @Scheduled(fixedRate = 15000)
    public void consumeFixedRate() {
        ZSetOperations<String, String> zset = redis.opsForZSet();

        // queue:*:waiting 패턴으로 모든 room 대기열 찾기
        Set<String> roomKeys = redis.keys("queue:*:waiting");
        if (roomKeys == null ) return;

        // 각 방을 키별로 조회
        for (String zsetKey : roomKeys) {
            // key에서 matchId 추출
            // 예: "queue:roomA:waiting" → "roomA"
            String matchIdString = zsetKey.replace("queue:", "").replace(":waiting", "");
            Long matchId = Long.valueOf(matchIdString);

            // 주어진 방에서, N명 감소 시키기.
            Set<ZSetOperations.TypedTuple<String>> popped = zset.popMin(zsetKey, CONSUME_RATE);
            if (popped == null || popped.isEmpty()) continue;

            for (ZSetOperations.TypedTuple<String> t : popped) {
                String userId = t.getValue();
                if (userId == null) continue;

                // 상태 변경
                // Duration 변경
                redis.opsForHash().put(QueueKeys.userStateKey(matchId, userId), "state", DEQUEUED);
                redis.expire(QueueKeys.userStateKey(matchId, userId), Duration.ofSeconds(3));

                // Kafka 발행
                // Queue에서 빠져나갔음을 이벤트로 발행
                Map<String, Object> payload = Map.of(
                        "matchId", matchId,
                        "userId", userId,
                        "ts", System.currentTimeMillis()
                );

                // Kafka Queue
                // user-log-queue 토픽에 이벤트 발행
                try {
                    kafkaTemplate.send(KafkaTopic.USER_LOG_QUEUE.getTopicName(), userId, mapper.writeValueAsString(payload));
                    log.info("Dequeued user {} from matchId {}", userId, matchId);
                } catch (Exception e) {
                    log.error("Kafka send failed for user {} in matchId {}", userId, matchId, e);
                    // 복구 로직: 다시 대기열에 추가
                    redis.opsForHash().put(QueueKeys.userStateKey(matchId, userId), "state", "WAITING");
                }
            }

            // 방에서 누적으로 빠진 사람 계산
            redis.opsForValue().increment(QueueKeys.roomOffset(matchId), popped.size());
            Long tot = zset.zCard(zsetKey);
            redis.opsForValue().set(QueueKeys.roomTotal(matchId), String.valueOf(tot==null?0:tot));


        }
    }

}*/
