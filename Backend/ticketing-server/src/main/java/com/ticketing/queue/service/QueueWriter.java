package com.ticketing.queue.service;

import com.ticketing.queue.QueueKeys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.StringRedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class QueueWriter {
    private final StringRedisTemplate redis;
    private static final int WINDOW = 3000; // 방마다 상위 3000명만 갱신 (원하면 조절)

    @Scheduled(fixedRate = 15000) // 10초마다 스냅샷 갱신
    public void refreshTopWindow() {
        ZSetOperations<String, String> zset = redis.opsForZSet();

        Set<String> roomKeys = redis.keys("queue:*:waiting");
        if (roomKeys == null || roomKeys.isEmpty()) return;

        for (String zkey : roomKeys) {
            // matchId 추출: "queue:roomA:waiting" -> "roomA"
            String matchIdString = zkey.replace("queue:", "").replace(":waiting", "");
            Long matchId = Long.valueOf(matchIdString);

            Long totL = zset.zCard(zkey);
            long total = (totL == null) ? 0L : totL;
            if (total == 0) continue;

            long end = Math.min(total - 1, WINDOW - 1);

            // ZRANGE로 상위 N명을 한 번에 가져오면 i=rank가 됨
            Set<String> members = zset.range(zkey, 0, end);
            if (members == null || members.isEmpty()) continue;

            // 파이프라인으로 per-user 해시 일괄 갱신 (ahead/behind/total)
            redis.executePipelined((RedisCallback<Object>) conn -> {
                StringRedisConnection c = (StringRedisConnection) conn;
                int i = 0; // i == ahead == 오름차순 rank
                long now = System.currentTimeMillis();

                for (String userId : members) {
                    long ahead  = i;
                    long behind = total - 1 - ahead;
                    String hkey = QueueKeys.userStateKey(matchId, userId);

                    String type = (String) redis.opsForHash().get(hkey,"playerType");
                    // 봇이면 해시 갱신 건너뛰되, i(순위)는 증가시켜야 함
                    if ("BOT".equals(type)) {
                        i++;
                        continue;
                    }

                    Map<String, String> m = new HashMap<>();
                    m.put("ahead", String.valueOf(ahead));
                    m.put("behind", String.valueOf(behind));
                    m.put("total", String.valueOf(total));
                    m.put("lastUpdated", String.valueOf(now));

                    c.hMSet(hkey, m);
                    /**
                     * 조정 필요
                     * */
                    // (선택) 짧은 TTL:
                    c.expire(hkey, 600);
                    i++;
                }
                return null;
            });
        }
    }


}
