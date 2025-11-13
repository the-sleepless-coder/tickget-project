package com.ticketing.queue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.KafkaTopic;
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
import com.ticketing.repository.MatchRepository;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
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

    // 대기 상태 ENUM
    private static final String ALREADY_IN_QUEUE="ALREADY_IN_QUEUE";
    private static final String WAITING = "WAITING";
    private static final String ENQUEUED = "ENQUEUED";
    // 플레이 타입
    private static final String BOT_TYPE = "robot";
    private static final String USER_TYPE = "user";

    private static final int MATCH_EXPIRE_TIME = 30;

    public QueueService(StringRedisTemplate redis, ObjectMapper mapper, KafkaTemplate kafkaTemplate, MatchRepository matchRepository, ApplicationEventPublisher publisher, ClientService Client){
        this.redis = redis;
        this.mapper = mapper;
        this.kafkaTemplate = kafkaTemplate;
        this.matchRepository = matchRepository;
        this.publisher = publisher;
        this.Client = Client;
    }

    // Redis에 Queue에 대한 순서 정보 저장
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
            log.info("Kafka: 사용자 Log 적재 이벤트 발행");

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
    // Scheduler?
    // 경기 시작 시, MatchStatus.Playing으로 바꿔준다.
    // 정해진 KafkaTopic에 시작했다는 사실을 발행한다.
    // Websocket으로 받는다.
    @Transactional
    public MatchResponseDTO startMatch(MatchRequestDTO dto){
        try{
            Match match = new Match();
            match.setRoomId(dto.getRoomId());
            match.setMatchName(dto.getMatchName());
            match.setMaxUser(dto.getMaxUserCount());
            match.setUsedBotCount(dto.getBotCount());
            match.setTotalSeats(dto.getTotalSeats());
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

            // 1) 로봇(봇 서버)에게 시작 알림 전송
            // 봇 생성 시간이 걸림.
            try {
                Client.sendBotRequest(matchId, botCount, startedAt, difficulty, hallId);
                log.debug("Successfully sent request to bot. matchId:{}, botCount:{}, startedAt:{}",matchId, botCount, startedAt);
            } catch (Exception ex) {
                // 필요 시 재시도/보상 로직 연결 (DLQ, 재시도 큐 등)
                // 로그만 남기고 종료할지, 예외를 던져 롤백할지는 정책에 따라 결정
                // 여기서는 로그만:
                log.error("Bot notify failed. roomId={} matchId={}", roomId, matchId, ex);
            }

            // 2) roomId에 대한 matchId를 Redis 키로 설정
            // DB에서 해당 matchId에 대한 roomId 조회
            Match MATCH = matchRepository.findById(matchId).orElseThrow();
            String roomKey = "room:%s:match:%s".formatted(MATCH.getRoomId(), MATCH.getMatchId());
            String matchKey = "match:%s:room".formatted(MATCH.getMatchId());

            redis.opsForValue().set(roomKey,"1");
            redis.opsForValue().set(matchKey, String.valueOf(MATCH.getRoomId()));
            redis.expire(roomKey, Duration.ofMinutes(MATCH_EXPIRE_TIME));
            redis.expire(matchKey, Duration.ofMinutes(MATCH_EXPIRE_TIME));

            // 3) 스케줄링을 통한, 시작 시간 N초 전 Thread 실행
            // Transactional로 DB, Playing Status, 매치 참여 인원 Redis 키 설정.
            publisher.publishEvent(new MatchInsertedEventDTO(
                saved.getMatchId(), saved.getRoomId(), saved.getStartedAt(), saved.getUsedBotCount(), saved.getDifficulty().toString(), dto.getHallId()
            ));

            return res;

        }catch(DataIntegrityViolationException e){
            e.printStackTrace();
            return null;
        }catch(Exception e){
            e.printStackTrace();
            return null;
        }

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
