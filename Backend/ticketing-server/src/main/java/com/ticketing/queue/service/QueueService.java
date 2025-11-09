package com.ticketing.queue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.queue.DTO.MatchRequestDTO;
import com.ticketing.queue.DTO.MatchResponseDTO;
import com.ticketing.queue.DTO.QueueDTO;
import com.ticketing.queue.DTO.QueueUserInfoDTO;
import com.ticketing.queue.QueueKeys;
import com.ticketing.entity.Match;
import com.ticketing.repository.MatchRepository;
import jakarta.transaction.Transactional;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class QueueService {
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final MatchRepository matchRepository;
    private final ApplicationEventPublisher publisher;

    // 대기 상태 ENUM
    private static final String ALREADY_IN_QUEUE="ALREADY_IN_QUEUE";
    private static final String WAITING = "WAITING";
    private static final String ENQUEUED = "ENQUEUED";
    // 플레이 타입
    private static final String BOT_TYPE = "robot";
    private static final String USER_TYPE = "user";

    private static final int MATCH_EXPIRE_TIME = 30;

    public QueueService(StringRedisTemplate redis, ObjectMapper mapper, KafkaTemplate kafkaTemplate, MatchRepository matchRepository, ApplicationEventPublisher publisher){
        this.redis = redis;
        this.mapper = mapper;
        this.kafkaTemplate = kafkaTemplate;
        this.matchRepository = matchRepository;
        this.publisher = publisher;
    }

    // Redis에 Queue에 대한 순서 정보 저장
    public QueueDTO enqueue(Long matchId, Long userIdLong, QueueUserInfoDTO dto ){
        String userId = String.valueOf(userIdLong);

        // 방별 sequence 이용, score 기준 순서 생성
        long now = System.currentTimeMillis();
        Long seq = redis.opsForValue().increment(QueueKeys.sequence(matchId));

        double score = now * 1_000_000d + (seq==null ? 0: seq);

        // ZSET에 순서가 작은 userId부터 넣어준다.
        // 이미 존재하는 userId라면 더하지 않는다.
        String zkeys = QueueKeys.waitingZSet(matchId);
        Boolean InQueue = redis.opsForZSet().add(zkeys, userId, score);
        // ZADD NX (이미 있으면 무시: 재정렬 방지)
        /*
        * ZSetOperations.TypedTuple<String> tuple = ZSetOperations.TypedTuple.of(userId, score);
        Long addedCnt = redis.opsForZSet()
                .add(zkeys, Set.of(tuple), RedisZSetCommands.ZAddArgs.ifNotExists());
        boolean added = addedCnt != null && addedCnt > 0;
        */


        // ZSET을 이용한 해당 이용자의 rank 및 방 내 사용자 수를 가져온다.
        Long rk = redis.opsForZSet().rank(zkeys, userId);
        Long tot = redis.opsForZSet().zCard(zkeys);

        long rank = (rk==null)? -1L: rk;
        long total = (tot==null) ? 0L : tot;

        long positionAhead = (rank>=0) ? rank: -1;
        long positionBehind = (rank>=0 && total>0)? total -1 - positionAhead: -1;


        //userId prefix에 따라, 봇이라면 playerType에 바꿈.
        String status = InQueue ? ENQUEUED : ALREADY_IN_QUEUE;

        /**
         * boolean isBot = tokenClaims.isBot();
         * */
        String playerType = userIdLong < 0 ? BOT_TYPE: USER_TYPE;

        // 각 user의 대기 상태, 현재 순위, 누적으로 빠진 사람 수를 HashMap 형태로 넣어둔다.
        // 봇은 ZSET에는 넣되, HashMap형태로 값을 저장하지 않도록 한다.
        /*Try-Catch로 Waiting 상태 반영*/
        if(userIdLong > 0){
            redis.opsForHash().put(QueueKeys.userStateKey(matchId, userId), "state", status);
            redis.opsForHash().put(QueueKeys.userStateKey(matchId, userId), "joinedAt", String.valueOf(now));

            redis.opsForHash().put(QueueKeys.userStateKey(matchId, userId), "rawRank", String.valueOf(rank));
            long joinOffset = redis.opsForValue().get(QueueKeys.roomOffset(matchId)) == null ? 0L: Long.parseLong(redis.opsForValue().get(QueueKeys.roomOffset(matchId)));
            redis.opsForHash().put(QueueKeys.userStateKey(matchId, userId), "joinOffset", String.valueOf(joinOffset));

            redis.opsForHash().put(QueueKeys.userStateKey(matchId, userId), "playerType", playerType);

            // matchId 내 roomOffset, sequence, total 관련 TTL
            redis.expire(QueueKeys.roomOffset(matchId), Duration.ofMinutes(MATCH_EXPIRE_TIME));
            redis.expire(QueueKeys.sequence(matchId), Duration.ofMinutes(MATCH_EXPIRE_TIME));
            redis.expire(QueueKeys.roomTotal(matchId), Duration.ofMinutes(MATCH_EXPIRE_TIME));
        }

        QueueDTO queueInfo = new QueueDTO(UUID.randomUUID().toString(), matchId, playerType, userId, status, positionAhead, positionBehind, total);

        // Log정보를 MongoDB에 저장한다.
        // Kafka 비동기로 처리.
        // SendResult<> = kafkaTemplate.send();


        return queueInfo;
    }

    // matchesDB에 데이터를 저장한다.
    @Transactional
    public MatchResponseDTO insertMatchData(MatchRequestDTO dto){
        try{
            Match match = new Match();
            match.setRoomId(dto.getRoomId());
            match.setMatchName(dto.getMatchName());
            match.setMaxUser(dto.getMaxUserCount());
            match.setUsedBotCount(dto.getBotCount());
            match.setDifficulty(dto.getDifficulty());
            match.setStartedAt(dto.getStartedAt());
            match.setCreatedAt(LocalDateTime.now());
            match.setUpdatedAt(LocalDateTime.now());
            match.setStatus(Match.MatchStatus.WAITING);

            Match saved = matchRepository.save(match);

            MatchResponseDTO res = new MatchResponseDTO(saved.getMatchId(), saved.getRoomId(), saved.getMatchName(), saved.getMaxUser(), saved.getDifficulty().name(), saved.getStartedAt());

            // DB에 커밋되고 나서, Redis에 room:{roomId}:match:{matchId}
            publisher.publishEvent(new MatchCacheWriter.MatchCreatedEvent(saved.getMatchId()));

            return res;

        }catch(DataIntegrityViolationException e){
            e.printStackTrace();
            return null;
        }catch(Exception e){
            e.printStackTrace();
            return null;
        }
    }

}
