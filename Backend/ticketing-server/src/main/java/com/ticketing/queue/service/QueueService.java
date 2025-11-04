package com.ticketing.queue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.queue.DTO.QueueDTO;
import com.ticketing.queue.QueueKeys;
import org.springframework.data.redis.connection.RedisZSetCommands;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class QueueService {
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;

    // 대기 상태 ENUM
    private static final String ALREADY_IN_QUEUE="ALREADY_IN_QUEUE";
    private static final String WAITING = "WAITING";
    private static final String ENQUEUED = "ENQUEUED";
    // 플레이 타입
    private static final String BOT_TYPE = "robot";
    private static final String USER_TYPE = "user";

    public QueueService(StringRedisTemplate redis, ObjectMapper mapper){
        this.redis = redis;
        this.mapper = mapper;
    }

    // Redis에 Queue에 대한 순서 정보 저장
    public QueueDTO enqueue(String roomId, String userId){
        // 방별 sequence 이용, score 기준 순서 생성
        long now = System.currentTimeMillis();
        Long seq = redis.opsForValue().increment(QueueKeys.sequence(roomId));
        double score = now * 1_000_000d + (seq==null ? 0: seq);

        // ZSET에 순서가 작은 userId부터 넣어준다.
        // 이미 존재하는 userId라면 더하지 않는다.
        Boolean InQueue = redis.opsForZSet().add(QueueKeys.waitingZSet(roomId), userId, score);
        // ZADD NX (이미 있으면 무시: 재정렬 방지)
        /*
        * ZSetOperations.TypedTuple<String> tuple = ZSetOperations.TypedTuple.of(userId, score);
        Long addedCnt = redis.opsForZSet()
                .add(QueueKeys.waitingZSet(roomId), Set.of(tuple), RedisZSetCommands.ZAddArgs.ifNotExists());
        boolean added = addedCnt != null && addedCnt > 0;
        */


        // ZSET을 이용한 해당 이용자의 rank 및 방 내 사용자 수를 가져온다.
        Long rk = redis.opsForZSet().rank(QueueKeys.waitingZSet(roomId), userId);
        Long tot = redis.opsForZSet().zCard(QueueKeys.waitingZSet(roomId));

        long rank = (rk==null)? -1L: rk;
        long total = (tot==null) ? 0L : tot;

        long positionAhead = (rank>=0) ? rank: -1;
        long positionBehind = (rank>=0 && total>0)? total -1 - positionAhead: -1;


        //userId prefix에 따라, 봇이라면 playerType에 바꿈.
        String status = InQueue ? ENQUEUED : ALREADY_IN_QUEUE;

        /**
         * boolean isBot = tokenClaims.isBot();
         * */
        String playerType = userId.startsWith("bot-")? BOT_TYPE: USER_TYPE;

        // 각 user의 대기 상태, 현재 순위, 누적으로 빠진 사람 수를 넣어둔다.
        /*Try-Catch로 Waiting 상태 반영*/
        redis.opsForHash().put(QueueKeys.userStateKey(roomId, userId), "state", status);
        redis.opsForHash().put(QueueKeys.userStateKey(roomId, userId), "joinedAt", String.valueOf(now));

        redis.opsForHash().put(QueueKeys.userStateKey(roomId, userId), "rawRank", String.valueOf(rank));
        long joinOffset = redis.opsForValue().get(QueueKeys.roomOffset(roomId)) == null ? 0L: Long.parseLong(redis.opsForValue().get(QueueKeys.roomOffset(roomId)));
        redis.opsForHash().put(QueueKeys.userStateKey(roomId, userId), "joinOffset", String.valueOf(joinOffset));

        redis.opsForHash().put(QueueKeys.userStateKey(roomId, userId), "playerType", playerType);

        QueueDTO queueInfo = new QueueDTO(UUID.randomUUID().toString(), roomId, playerType, userId, status, positionAhead, positionBehind, total);

        return queueInfo;
    }


}
