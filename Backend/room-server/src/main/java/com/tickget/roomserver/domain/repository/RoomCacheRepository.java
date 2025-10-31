package com.tickget.roomserver.domain.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tickget.roomserver.dto.cache.RoomMember;
import com.tickget.roomserver.dto.cache.RoomInfo;
import com.tickget.roomserver.dto.request.CreateRoomRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
public class RoomCacheRepository {

    private final RedisTemplate<String,String> redisTemplate;
    private final ObjectMapper mapper = new ObjectMapper();

    public void saveRoom(Long roomId, CreateRoomRequest request) throws JsonProcessingException {
        String infoKey = "room:" + roomId+ ":info";

        Map<String, String> roomInfo = new HashMap<>();
        roomInfo.put("maxUserCount", String.valueOf(request.getMaxUserCount()));
        roomInfo.put("host", String.valueOf(request.getUserId()));
        roomInfo.put("title", request.getMatchName());
        roomInfo.put("difficulty",request.getDifficulty().toString());
        roomInfo.put("createdAt", String.valueOf(System.currentTimeMillis()));

        addMemberToRoom(roomId, request.getUserId(), request.getUsername());
        redisTemplate.opsForHash().putAll(infoKey, roomInfo);

        redisTemplate.expire(infoKey, 24, TimeUnit.HOURS);
    }

    public Integer addMemberToRoom(Long roomId, Long userId, String username) throws JsonProcessingException {
        String memberKey ="room:" + roomId+ ":member";

        RoomMember roomMember = new RoomMember(userId, username, System.currentTimeMillis());
        String json = mapper.writeValueAsString(roomMember);
        redisTemplate.opsForHash().put(memberKey, userId, json);
        redisTemplate.expire(memberKey, 24, TimeUnit.HOURS);

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
}
