package com.tickget.roomserver.domain.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tickget.roomserver.dto.cache.GlobalSessionInfo;
import com.tickget.roomserver.dto.cache.QueueStatus;
import com.tickget.roomserver.dto.cache.RoomInfoUpdate;
import com.tickget.roomserver.dto.cache.RoomMember;
import com.tickget.roomserver.dto.cache.RoomInfo;
import com.tickget.roomserver.dto.request.CreateRoomRequest;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class RoomCacheRepository {

    private final RedisTemplate<String,String> redisTemplate;
    private final ObjectMapper mapper;

    public void saveRoom(Long roomId, CreateRoomRequest request) {
        String infoKey = "room:" + roomId+ ":info";

        Map<String, String> roomInfo = new HashMap<>();
        roomInfo.put("maxUserCount", String.valueOf(request.getMaxUserCount()));
        roomInfo.put("host", String.valueOf(request.getUserId()));
        roomInfo.put("title", request.getMatchName());
        roomInfo.put("difficulty",request.getDifficulty().toString());
        roomInfo.put("createdAt", String.valueOf(System.currentTimeMillis()));

        redisTemplate.opsForHash().putAll(infoKey, roomInfo);

        redisTemplate.expire(infoKey, 24, TimeUnit.HOURS);
    }
    public void updateRoomInfo(RoomInfoUpdate update) {
        String infoKey = "room:" + update.getRoomId() + ":info";

        if (update.getMatchName() != null) {
            redisTemplate.opsForHash().put(infoKey, "title", update.getMatchName());
        }

        if (update.getDifficulty() != null) {
            redisTemplate.opsForHash().put(infoKey, "difficulty", update.getDifficulty());
        }

        if (update.getMaxUserCount() != null) {
            redisTemplate.opsForHash().put(infoKey, "maxUserCount", String.valueOf(update.getMaxUserCount()));
        }

        if (update.getStartTime() != null) {
            Long startTimeMillis = update.getStartTime();
            redisTemplate.opsForHash().put(infoKey, "startTime", String.valueOf(startTimeMillis));
        }

        log.info("방 정보 업데이트: roomId={}, title={},difficulty={}, maxUserCount={}, startTime={}",
                update.getRoomId(),update.getMatchName(), update.getDifficulty(), update.getMaxUserCount(), update.getStartTime());
    }

    public Integer addMemberToRoom(Long roomId, Long userId, String username) throws JsonProcessingException {
        String memberKey ="room:" + roomId+ ":members";

        RoomMember roomMember = new RoomMember(userId, username, System.currentTimeMillis());
        String json = mapper.writeValueAsString(roomMember);
        redisTemplate.opsForHash().put(memberKey, String.valueOf(userId), json);

        return Math.toIntExact(redisTemplate.opsForHash().size(memberKey));
    }

    public RoomInfo getRoomInfo(Long roomId){
        String infoKey = "room:" + roomId + ":info";
        String memberKey = "room:" + roomId + ":members";

        Map<Object, Object> info = redisTemplate.opsForHash().entries(infoKey);

        if (info.get("title")==null) {
            return RoomInfo.builder()
                    .roomId(roomId)
                    .title("title")
                    .hostId(1L)
                    .difficulty("difficulty")
                    .maxUserCount(10)
                    .currentUserCount(0)
                    .createdAt(1L)
                    .build();
        }

        // 현재 인원 수
        Long currentCount = redisTemplate.opsForHash().size(memberKey);

        return RoomInfo.builder()
                .roomId(roomId)
                .title(info.get("title").toString())
                .hostId((Long) info.get("host"))
                .difficulty(info.get("difficulty").toString())
                .maxUserCount(Integer.parseInt(info.get("maxUserCount").toString()))
                .currentUserCount(Math.toIntExact(currentCount))
                .createdAt(Long.parseLong(info.get("createdAt").toString()))
                .build();
    }

    public List<RoomMember> getRoomMembers(Long roomId) throws JsonProcessingException {
        String memberKey = "room:" + roomId + ":members";
        Map<Object, Object> entries = redisTemplate.opsForHash().entries(memberKey);

        List<RoomMember> collect = new ArrayList<>();
        for (Object json : entries.values()) {
            RoomMember roomMember = mapper.readValue((String) json, RoomMember.class);
            collect.add(roomMember);
        }

        return collect;
    }

    public Integer getRoomCurrentUserCount(Long roomId){
        String memberKey = "room:" + roomId+ ":members";
        return Math.toIntExact(redisTemplate.opsForHash().size(memberKey));
    }

    public void removeMemberFromRoom(Long roomId, Long userId) {
        String memberKey = "room:" + roomId+ ":members";
        redisTemplate.opsForHash().delete(memberKey, String.valueOf(userId));
    }

    public void deleteRoom(Long roomId) {
        String memberKey = "room:" + roomId+ ":members";
        String infoKey = "room:" + roomId + ":info";
        redisTemplate.delete(memberKey);
        redisTemplate.delete(infoKey);
    }

    public String transferHost(Long roomId) {
        String infoKey = "room:" + roomId + ":info";
        String memberKey = "room:" + roomId + ":members";

        // 1. 남은 멤버 중 첫 번째 가져오기
        Map<Object, Object> members = redisTemplate.opsForHash().entries(memberKey);

        if (members.isEmpty()) {
            return null;
        }

        // 2. 첫 번째 멤버를 새 방장으로
        String newHostId = (String) members.keySet().iterator().next();

        // 3. Redis 업데이트
        redisTemplate.opsForHash().put(infoKey, "host", newHostId);

        return newHostId;
    }

    public String getUserName(Long roomId, Long userId) {
        String memberKey = "room:" + roomId + ":members";
        String json = (String) redisTemplate.opsForHash().get(memberKey, String.valueOf(userId));

        if (json == null) {
            return "Unknown";
        }

        try {
            RoomMember member = mapper.readValue(json, RoomMember.class);
            return member.getUsername();
        } catch (JsonProcessingException e) {
            return "Unknown";
        }
    }


    public void registerGlobalSession(Long userId, String sessionId, String serverId) {
        String sessionKey = "user:" + userId + ":session";
        String serverKey = "user:" + userId + ":server";

        // 기존 세션 정보 조회
        String oldSessionId = redisTemplate.opsForValue().get(sessionKey);
        String oldServerId = redisTemplate.opsForValue().get(serverKey);

        if (oldSessionId != null) {
            log.warn("유저 {}의 기존 전역 세션 발견 - sessionId: {}, serverId: {}",
                    userId, oldSessionId, oldServerId);
        }

        // 새 세션 정보 저장
        redisTemplate.opsForValue().set(sessionKey, sessionId, 24, TimeUnit.HOURS);
        redisTemplate.opsForValue().set(serverKey, serverId, 24, TimeUnit.HOURS);

        log.debug("전역 세션 등록: userId={}, sessionId={}, serverId={}", userId, sessionId, serverId);
    }


    public GlobalSessionInfo getGlobalSession(Long userId) {
        String sessionKey = "user:" + userId + ":session";
        String serverKey = "user:" + userId + ":server";

        String sessionId = redisTemplate.opsForValue().get(sessionKey);
        String serverId = redisTemplate.opsForValue().get(serverKey);

        if (sessionId == null) {
            return null;
        }

        return new GlobalSessionInfo(sessionId, serverId);
    }

    // 전역 세션 제거
    public void removeGlobalSession(Long userId) {
        String sessionKey = "user:" + userId + ":session";
        String serverKey = "user:" + userId + ":server";

        redisTemplate.delete(sessionKey);
        redisTemplate.delete(serverKey);

        log.debug("전역 세션 제거: userId={}", userId);
    }

    // 방 ID로 매치 ID 조회
    public String getMatchIdByRoomId(Long roomId) {
        // 실제로 저장된 구조 -> room:{roomId}:match:{matchId}
        String pattern = "room:" + roomId + ":match:*";
        Set<String> keys = redisTemplate.keys(pattern);

        if (keys.isEmpty()) {
            log.debug("방 {}의 매치 ID를 찾을 수 없음", roomId);
            return null;
        }

        // 패턴에 맞는 키가 여러 개일 가능성은 낮다고 보고 첫 번째 것만 사용
        String key = keys.iterator().next(); // e.g. room:123:match:456
        String[] parts = key.split(":");
        String matchId = parts[parts.length - 1];

        return matchId;
    }


    //유저의 대기열 상태 조회
    public QueueStatus getQueueStatus(String matchId, Long userId) {
        String queueKey = "queue:" + matchId + ":" + userId;
        String json = redisTemplate.opsForValue().get(queueKey);

        if (json == null) {
            return null;
        }

        try {
            return mapper.readValue(json, QueueStatus.class);
        } catch (JsonProcessingException e) {
            log.error("대기열 상태 파싱 실패: matchId={}, userId={}, error={}",
                    matchId, userId, e.getMessage());
            return null;
        }
    }
}
