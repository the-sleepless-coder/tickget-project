package com.ticketing.queue.service;

import com.ticketing.KafkaTopic;
import com.ticketing.entity.Match;
import com.ticketing.queue.DTO.MatchStartDTO;
import com.ticketing.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.ExecutionException;
/*
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchScheduler {

    private final MatchRepository matchRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final StringRedisTemplate redis;
    private final BotClientService botClient;

    private static final String MATCH_STATUS = "match:%s:status";
    private static final String OPEN = "OPEN";

    // 10초마다 검사
    // 시작 10초 전에 경기 Status를 Playing으로 바꿔준다.
    @Scheduled(fixedRate = 10_000)
    @Transactional
    public void updateMatchStatus() throws ExecutionException, InterruptedException {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime threshold = now.plusSeconds(15);

        // WAITING 중인데 startedAt - 10초 지난 매치들 찾기
        List<Match> matches = matchRepository.findByStatusAndStartedAtBefore(
                Match.MatchStatus.WAITING,
                threshold
        );

        // 1. Playing Status DB 반영
        for (Match match : matches) {
            match.setStatus(Match.MatchStatus.PLAYING);
        }

        matchRepository.saveAll(matches);


//         DB 변경 후, Kafka Publisher 발행
//         Outbox Pattern 구현
        for(Match match: matches){
            String matchIdString = String.valueOf(match.getMatchId());
            Long roomId = match.getRoomId();

//            MatchStartDTO dto = MatchStartDTO.builder()
//                    .roomId(match.getRoomId())
//                    .matchId(match.getMatchId())
//                    .startedAt(match.getStartedAt())
//                    .status(match.getStatus())
//                    .timestamp(LocalDateTime.now())
//                    .build();
//
//            SendResult<String, Object> kafkaObject = kafkaTemplate.send(KafkaTopic.ROOM_PLAYING_STATUS_EVENTS.getTopicName(), matchIdString, dto).get();


            //2. Bot 서버로 시작했다는 요청을 보낸다.
            botClient.changeStartState(roomId);

            // 3. Redis Key 발급
            // matchStartKey에 OPEN을 설정.
            String matchStartKey = MATCH_STATUS.formatted(matchIdString);
            redis.opsForValue().set(matchStartKey, OPEN);

        }


    }
}
**/