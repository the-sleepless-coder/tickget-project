package com.ticketing.queue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.KafkaTopic;
import com.ticketing.entity.Outbox;
import com.ticketing.queue.DTO.MatchInsertedEventDTO;
import com.ticketing.queue.DTO.QueueLogDTO;
import com.ticketing.queue.DTO.request.MatchRequestDTO;
import com.ticketing.queue.DTO.response.MatchIdResponseDTO;
import com.ticketing.queue.DTO.QueueDTO;
import com.ticketing.queue.DTO.QueueUserInfoDTO;
import com.ticketing.queue.DTO.response.MatchResponseDTO;
import com.ticketing.queue.domain.enums.QueueKeys;
import com.ticketing.entity.Match;
import com.ticketing.queue.exception.DuplicateMatchFoundException;
import com.ticketing.queue.outbox.OutboxEventType;
import com.ticketing.repository.MatchRepository;
import com.ticketing.repository.OutboxRepository;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
public class QueueService {
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final MatchRepository matchRepository;
    private final ApplicationEventPublisher publisher;
    private final ClientService Client;
    private final OutboxRepository outboxRepository;

    // 대기 상태 ENUM
    private static final String ALREADY_IN_QUEUE="ALREADY_IN_QUEUE";
    private static final String WAITING = "WAITING";
    private static final String ENQUEUED = "ENQUEUED";
    // 플레이 타입
    private static final String BOT_TYPE = "robot";
    private static final String USER_TYPE = "user";

    private static final int MATCH_EXPIRE_TIME = 30;

    public record OutboxCreatedEvent(Long outboxId){};

    public QueueService(StringRedisTemplate redis, ObjectMapper mapper, KafkaTemplate kafkaTemplate, MatchRepository matchRepository, ApplicationEventPublisher publisher, ClientService Client, OutboxRepository outboxRepository){
        this.redis = redis;
        this.mapper = mapper;
        this.kafkaTemplate = kafkaTemplate;
        this.matchRepository = matchRepository;
        this.publisher = publisher;
        this.Client = Client;
        this.outboxRepository = outboxRepository;
    }

    // Redis에 대기열 진입 및 시간에 따른 등수 감소하는 코드.
    public QueueDTO enqueue(Long matchId, Long userIdLong, QueueUserInfoDTO userInfo ) throws ExecutionException, InterruptedException {
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

        // 이미 토큰을 통해 검증이 된 채로,
        // userIdLong에 대해 검증하면 userType을 알 수 있다.
        String playerType = userIdLong < 0 ? BOT_TYPE: USER_TYPE;

        // 각 matchId userId 조합의 키에 대기 상태, 현재 순위, 누적으로 빠진 사람 수를 HashMap 형태로 Value를 저장한다.
        // 봇은 ZSET에는 넣되, HashMap형태로 값을 저장하지 않도록 한다.
        /*Try-Catch로 Waiting 상태 반영*/
        if(userIdLong > 0){
            redis.opsForHash().put(QueueKeys.userStateKey(matchId, userId), "state", status);
            redis.opsForHash().put(QueueKeys.userStateKey(matchId, userId), "joinedAt", String.valueOf(now));

            redis.opsForHash().put(QueueKeys.userStateKey(matchId, userId), "rawRank", String.valueOf(rank));
            long joinOffset = redis.opsForValue().get(QueueKeys.roomOffset(matchId)) == null ? 0L: Long.parseLong(redis.opsForValue().get(QueueKeys.roomOffset(matchId)));
            redis.opsForHash().put(QueueKeys.userStateKey(matchId, userId), "joinOffset", String.valueOf(joinOffset));

            redis.opsForHash().put(QueueKeys.userStateKey(matchId, userId), "playerType", playerType);

            // 등수 갱신 대상(사람)만 별도 SET 에 등록 → 전체 스캔 대신 이 SET 만 순회
            redis.opsForSet().add(QueueKeys.humansSet(matchId), userId);
            redis.expire(QueueKeys.humansSet(matchId), Duration.ofMinutes(MATCH_EXPIRE_TIME));

            // matchId 내 roomOffset, sequence, total 관련 TTL
            redis.expire(QueueKeys.roomOffset(matchId), Duration.ofMinutes(MATCH_EXPIRE_TIME));
            redis.expire(QueueKeys.sequence(matchId), Duration.ofMinutes(MATCH_EXPIRE_TIME));
            redis.expire(QueueKeys.roomTotal(matchId), Duration.ofMinutes(MATCH_EXPIRE_TIME));
        }

        String randomUUID = UUID.randomUUID().toString();
        QueueDTO queueInfo = new QueueDTO( randomUUID, matchId, playerType, userId, status, positionAhead, positionBehind, total);

        // Log정보를 MongoDB에 저장한다.
        // Kafka 비동기로 MongoDB 처리.
        /**
         * DLT 처리가 필요할까?
         * */
        QueueLogDTO logDto = QueueLogDTO.of(randomUUID, matchId, playerType, userId, status, positionAhead, positionBehind, total, userInfo.getClickMiss(), userInfo.getDuration(), LocalDateTime.now());
        try{
            SendResult<String, Object> recordData = kafkaTemplate.send(KafkaTopic.USER_LOG_QUEUE.getTopicName(), userId, logDto).get();
            // log.info("Kafka: 사용자 Log 적재 이벤트 발행");

        }catch(Exception e){
            e.printStackTrace();
        }


        return queueInfo;
    }

    // matchesDB에 데이터를 저장한다.
    /**
     * Outbox Pattern
     * matchesDB에 상태 변화 후, Kakfa Producer발행 보장
     * */
    // 경기가 시작하면서 필요한 데이터 처리 구현.
    // 경기 시작 시, 경기 관련 데이터를 저장한다.
    // 봇 서버한테 경기 관련 데이터 전송
    // 방과 경기 관련 데이터

    // 경기 시작 10초 전 매치 상태 변경
    // 다른 작업 처리할 수 있게 비동기로 처리
    @Transactional
    public MatchResponseDTO startMatch(MatchRequestDTO dto){
        // 멱등 처리: 같은 idempotencyKey로 만든 매치가 이미 있으면(응답 유실로 인한 @Retry 재시도)
        //           새로 만들지 않고 기존 매치를 그대로 반환한다. → 중복 매치를 만들지 않는다.
        if (dto.getIdempotencyKey() != null) {
            Optional<Match> existing = matchRepository.findByIdempotencyKey(dto.getIdempotencyKey());
            if (existing.isPresent()) {
                Match f = existing.get();
                return new MatchResponseDTO(f.getMatchId(), f.getRoomId(), f.getMatchName(),
                        f.getMaxUser(), f.getDifficulty().name(), f.getStartedAt());
            }
        }

        //1.경기 설정 데이터 DB에 저장.
        Match match = new Match();
        match.setIdempotencyKey(dto.getIdempotencyKey());
        match.setRoomId(dto.getRoomId());
        match.setMatchName(dto.getMatchName());
        match.setMaxUser(dto.getMaxUserCount());
        match.setUsedBotCount(dto.getBotCount());
        //match.setTotalSeats(dto.getTotalSeats());
        match.setDifficulty(dto.getDifficulty());
        match.setStartedAt(dto.getStartedAt());
        match.setCreatedAt(LocalDateTime.now());
        match.setUpdatedAt(LocalDateTime.now());
        match.setStatus(Match.MatchStatus.WAITING);
        match.setTimeLimitSeconds(MATCH_EXPIRE_TIME * 60);

        Match saved = matchRepository.save(match);
        MatchResponseDTO res = new MatchResponseDTO(saved.getMatchId(), saved.getRoomId(), saved.getMatchName(), saved.getMaxUser(), saved.getDifficulty().name(), saved.getStartedAt());

        Long matchId = saved.getMatchId();
        int botCount = saved.getUsedBotCount();
        LocalDateTime startedAt = saved.getStartedAt();
        String difficulty = saved.getDifficulty().toString();
        Long hallId = dto.getHallId();
        Long roomId = saved.getRoomId();
        
        // 2. roomId에 대한 matchId를 Redis 키로 설정
        List<String> redisKeys = new ArrayList<>();
        try{
            String roomKey = "room:%s:match:%s".formatted(roomId, matchId);
            String matchKey = "match:%s:room".formatted(matchId);

            redis.opsForValue().set(roomKey,"1");
            redisKeys.add(roomKey);
            
            redis.opsForValue().set(matchKey, String.valueOf(saved.getRoomId()));
            redisKeys.add(matchKey);

            redis.expire(roomKey, Duration.ofMinutes(MATCH_EXPIRE_TIME));
            redis.expire(matchKey, Duration.ofMinutes(MATCH_EXPIRE_TIME));

            // 3. 봇 서버에게 경기 시작 알림 전송
            // Outbox pattern을 이용해 DB에 발행 이벤트 저장 && Kafka에 발행
            // (After Commit 이후 Kafka발행을 같이 묶음)
            // 동기 retry -> DB 저장 && Kafka로 이벤트 발행
            // Client.sendBotRequest(matchId, botCount, startedAt, difficulty, hallId);
            String payload = mapper.writeValueAsString(
              Map.of(
              "matchId", matchId,
              "botCount", botCount,
              "startTime", startedAt.toString(),
              "difficulty", difficulty,
              "hallId", hallId
              )
            );

            Outbox outbox = Outbox.builder()
                    .aggregateType(Outbox.AggregateType.BOT)
                    .aggregateId(matchId)
                    .eventType(OutboxEventType.BOT_PREPARE_REQUESTED)
                    .payload(payload)
                    .status(Outbox.OutboxStatus.PENDING)
                    .retryCount(0)
                    .createdTime(LocalDateTime.now())
                    .build();

            outboxRepository.save(outbox);
            publisher.publishEvent(new OutboxCreatedEvent(outbox.getId()));

            // 4. 이벤트 발행을 통해 경기 시작 10초전 경기 상태 변경 
            // Transactional로 DB, Playing Status, 매치 참여 인원 Redis 키 설정.
            publisher.publishEvent(new MatchInsertedEventDTO(
                saved.getMatchId(), saved.getRoomId(), saved.getStartedAt(), saved.getUsedBotCount(), saved.getDifficulty().toString(), dto.getHallId()
            ));

        }catch(Exception e){
            log.error("경기 생성 실패 - 보상 트랜잭션 실행", e);
            // Redis 키 설정 실패 시 , 
            // 해당 키를 저장한 리스트에서 제거.
            for(String key:redisKeys){
                try{
                    redis.delete(key);
                    log.info("Redis Key 삭제:{}", key);
                }catch(Exception redisExp){
                    log.error("Redis 롤백 실패:{}", key, redisExp);
                }
            }

            throw new RuntimeException("경기 시작 Redis 키 설정 실패", e);
        }


        return res;
    }



    // roomId를 입력하면 WAITING 상태의 matchId를 반환한다.
    public MatchIdResponseDTO getMatchData(Long roomId){
        // 값 존재할 시 matchId를 돌려준다.
        List<Match> matches = matchRepository.findByRoomIdAndStatus(roomId, Match.MatchStatus.WAITING);

        if(matches == null){
            return null;
        }

        if(matches.size() >= 2){
            throw new DuplicateMatchFoundException(String.format("%s에 대해 방이 2개 이상 발견 됐습니다.", roomId));
        }

        Match match = matches.get(0);
        Long matchId = match.getMatchId();
        Match.MatchStatus status = match.getStatus();

        MatchIdResponseDTO res = new MatchIdResponseDTO(matchId, roomId, status);

        return res;
    }

}
