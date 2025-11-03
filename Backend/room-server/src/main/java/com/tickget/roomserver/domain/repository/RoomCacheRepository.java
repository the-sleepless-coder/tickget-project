package com.tickget.roomserver.domain.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tickget.roomserver.dto.cache.GlobalSessionInfo;
import com.tickget.roomserver.dto.cache.RoomMember;
import com.tickget.roomserver.dto.cache.RoomInfo;
import com.tickget.roomserver.dto.request.CreateRoomRequest;
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

    public void saveRoom(Long roomId, CreateRoomRequest request) throws JsonProcessingException {
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

        // 현재 인원 수
        Long currentCount = redisTemplate.opsForHash().size(memberKey);

        return RoomInfo.builder()
                .roomId(roomId)
                .title(info.get("title").toString())
                .host( info.get("host").toString())
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
}
