package com.tickget.roomserver.domain.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tickget.roomserver.dto.cache.DisconnectInfo;
import com.tickget.roomserver.dto.cache.GlobalSessionInfo;
import com.tickget.roomserver.dto.cache.QueueStatus;
import com.tickget.roomserver.dto.cache.RoomInfoUpdate;
import com.tickget.roomserver.dto.cache.RoomMember;
import com.tickget.roomserver.dto.cache.RoomInfo;
import com.tickget.roomserver.dto.request.CreateRoomRequest;
import java.util.Collections;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
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

    private final RedisScript<Long> registerGlobalSessionScript;
    private final RedisScript<Long> removeGlobalSessionIfMatchScript;

    private static final String GLOBAL_SESSION_PREFIX = "global:session:";

    public void saveRoom(Long roomId, CreateRoomRequest request) {
        String infoKey = "room:" + roomId+ ":info";

        Map<String, String> roomInfo = new HashMap<>();
        roomInfo.put("maxUserCount", String.valueOf(request.getMaxUserCount()));
        roomInfo.put("host", String.valueOf(request.getUserId()));
        roomInfo.put("title", request.getMatchName());
        roomInfo.put("difficulty",request.getDifficulty().toString());
        roomInfo.put("createdAt", String.valueOf(System.currentTimeMillis()));

        // gameStartTime이 있으면 저장
        if (request.getGameStartTime() != null) {
            long startTimeMillis = request.getGameStartTime()
                    .atZone(java.time.ZoneId.systemDefault())
                    .toInstant()
                    .toEpochMilli();
            roomInfo.put("startTime", String.valueOf(startTimeMillis));
        }

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

        redisTemplate.expire(infoKey, 24, TimeUnit.HOURS);

        log.info("방 정보 업데이트: roomId={}, title={},difficulty={}, maxUserCount={}, startTime={}",
                update.getRoomId(),update.getMatchName(), update.getDifficulty(), update.getMaxUserCount(), update.getStartTime());
    }

    public void updateStartTime(Long roomId, java.time.LocalDateTime startTime) {
        String infoKey = "room:" + roomId + ":info";

        if (startTime != null) {
            long startTimeMillis = startTime
                    .atZone(java.time.ZoneId.systemDefault())
                    .toInstant()
                    .toEpochMilli();
            redisTemplate.opsForHash().put(infoKey, "startTime", String.valueOf(startTimeMillis));

            redisTemplate.expire(infoKey, 24, TimeUnit.HOURS);

            log.debug("방 {}의 startTime 업데이트: {}", roomId, startTime);
        }
    }

    public Integer addMemberToRoom(Long roomId, Long userId, String username, String profileImageUrl) throws JsonProcessingException {
        String memberKey ="room:" + roomId+ ":members";

        RoomMember roomMember = new RoomMember(userId, username, System.currentTimeMillis(), profileImageUrl);
        String json = mapper.writeValueAsString(roomMember);

        redisTemplate.opsForHash().put(memberKey, String.valueOf(userId), json);
        redisTemplate.expire(memberKey, 24, TimeUnit.HOURS);

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

        // startTime은 optional이므로 null 체크
        Long startTime = null;
        if (info.get("startTime") != null) {
            startTime = Long.parseLong(info.get("startTime").toString());
        }

        return RoomInfo.builder()
                .roomId(roomId)
                .title(info.get("title").toString())
                .hostId(Long.parseLong(info.get("host").toString()))
                .difficulty(info.get("difficulty").toString())
                .maxUserCount(Integer.parseInt(info.get("maxUserCount").toString()))
                .currentUserCount(Math.toIntExact(currentCount))
                .createdAt(Long.parseLong(info.get("createdAt").toString()))
                .startTime(startTime)
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
        redisTemplate.expire(memberKey, 24, TimeUnit.HOURS);

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


    /**
     * 전역 세션 등록 (Lua Script - 원자적)
     * 변경사항:
     * - 기존: GET → 계산 → SET (3단계, 비원자적)
     * - 개선: Lua Script 1회 호출 (원자적)
     * 효과:
     * - 동시 등록 시 version 충돌 방지
     * - 네트워크 왕복 감소 (2회 → 1회)
     *
     * @param userId 유저 ID
     * @param sessionId 세션 ID
     * @param serverId 서버 ID
     * @return 새로운 version
     */
    public Long registerGlobalSession(Long userId, String sessionId, String serverId) {
        try {
            // Lua Script 실행 (원자적)
            Long newVersion = redisTemplate.execute(
                    registerGlobalSessionScript,
                    Collections.singletonList(String.valueOf(userId)),  // KEYS[1]
                    sessionId,    // ARGV[1]
                    serverId      // ARGV[2]
            );
            String key = GLOBAL_SESSION_PREFIX +userId;
            redisTemplate.expire(key, 24, TimeUnit.HOURS);

            log.info("전역 세션 등록 완료 (Lua): userId={}, sessionId={}, serverId={}, version={}",
                    userId, sessionId, serverId, newVersion);

            return newVersion;

        } catch (Exception e) {
            log.error("전역 세션 등록 실패 (Lua): userId={}, sessionId={}", userId, sessionId, e);

            // Fallback: 기존 방식 (비원자적)
            log.warn("Fallback 실행: 비원자적 방식으로 전역 세션 등록 시도");
            return registerGlobalSessionFallback(userId, sessionId, serverId);
        }
    }

    /**
     * Fallback: 기존 비원자적 방식
     * Lua Script 실패 시에만 사용
     */
    private Long registerGlobalSessionFallback(Long userId, String sessionId, String serverId) {
        String key = GLOBAL_SESSION_PREFIX + userId;

        // 기존 세션 조회
        GlobalSessionInfo current = getGlobalSession(userId);

        // version 계산
        Long version = (current != null) ? current.getVersion() + 1 : 1L;

        // 저장
        GlobalSessionInfo newSession = GlobalSessionInfo.builder()
                .sessionId(sessionId)
                .serverId(serverId)
                .version(version)
                .build();

        redisTemplate.opsForHash().putAll(key, Map.of(
                "sessionId", sessionId,
                "serverId", serverId,
                "version", version.toString()
        ));

        redisTemplate.expire(key, 24, TimeUnit.HOURS);

        return version;
    }

    /**
     * 전역 세션 조회
     *
     * @param userId 유저 ID
     * @return GlobalSessionInfo 또는 null
     */
    public GlobalSessionInfo getGlobalSession(Long userId) {
        try {
            String key = GLOBAL_SESSION_PREFIX + userId;

            String sessionId = (String) redisTemplate.opsForHash().get(key, "sessionId");
            String serverId = (String) redisTemplate.opsForHash().get(key, "serverId");
            String versionStr = (String) redisTemplate.opsForHash().get(key, "version");

            if (sessionId == null || serverId == null || versionStr == null) {
                return null;
            }

            return GlobalSessionInfo.builder()
                    .sessionId(sessionId)
                    .serverId(serverId)
                    .version(Long.parseLong(versionStr))
                    .build();

        } catch (Exception e) {
            log.error("전역 세션 조회 실패: userId={}", userId, e);
            return null;
        }
    }

    /**
     * 전역 세션 삭제 (Lua Script - 원자적)
     *
     * 변경사항:
     * - 기존: GET → 비교 → DELETE (3단계, 비원자적)
     * - 개선: Lua Script 1회 호출 (원자적)
     *
     * 효과:
     * - 새 세션이 등록된 경우 자동으로 삭제 방지
     * - 네트워크 왕복 감소 (2회 → 1회)
     *
     * @param userId 유저 ID
     * @param sessionId 예상되는 세션 ID (이것과 일치해야 삭제)
     * @return true=삭제됨, false=삭제 안됨
     */
    public boolean removeGlobalSession(Long userId, String sessionId) {
        try {
            // Lua Script 실행 (원자적)
            Long result = redisTemplate.execute(
                    removeGlobalSessionIfMatchScript,
                    Collections.singletonList(String.valueOf(userId)),  // KEYS[1]
                    sessionId  // ARGV[1]
            );

            boolean deleted = (result != null && result == 1L);

            if (deleted) {
                log.info("전역 세션 삭제 완료 (Lua): userId={}, sessionId={}", userId, sessionId);
            } else {
                log.debug("전역 세션 삭제 안됨 (Lua): userId={}, sessionId={} (불일치 또는 없음)",
                        userId, sessionId);
            }

            return deleted;

        } catch (Exception e) {
            log.error("전역 세션 삭제 실패 (Lua): userId={}, sessionId={}", userId, sessionId, e);

            // Fallback: 기존 방식 (비원자적)
            log.warn("Fallback 실행: 비원자적 방식으로 전역 세션 삭제 시도");
            return removeGlobalSessionFallback(userId, sessionId);
        }
    }

    /**
     * Fallback: 기존 비원자적 방식
     * Lua Script 실패 시에만 사용
     */
    private boolean removeGlobalSessionFallback(Long userId, String sessionId) {
        GlobalSessionInfo current = getGlobalSession(userId);

        if (current != null && current.getSessionId().equals(sessionId)) {
            String key = GLOBAL_SESSION_PREFIX + userId;
            redisTemplate.delete(key);
            return true;
        }

        return false;
    }


    // 방 ID로 매치 ID 조회
    public Long getMatchIdByRoomId(Long roomId) {
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

        return Long.valueOf(matchId);
    }


    //유저의 대기열 상태 조회
    public QueueStatus getQueueStatus(Long matchId, Long userId) {
        String queueKey = "queue:" + matchId + ":" + userId;

        // Hash의 모든 필드 조회
        Map<Object, Object> data = redisTemplate.opsForHash().entries(queueKey);

        if (data.isEmpty()) {
            return null;
        }

        try {
            // Hash 데이터를 QueueStatus 객체로 변환
            return QueueStatus.builder()
                    .ahead(getLong(data, "ahead"))
                    .behind(getLong(data, "behind"))
                    .total(getLong(data, "total"))
                    .lastUpdated(getLong(data, "lastUpdated"))
                    .build();

        } catch (Exception e) {
            log.error("대기열 상태 변환 실패: matchId={}, userId={}, error={}",
                    matchId, userId, e.getMessage());
            return null;
        }
    }

    //재연결 정보 저장 (TTL 5초)
    public void saveDisconnectInfo(Long userId, DisconnectInfo info) {
        try {
            String key = "reconnect:" + userId;
            String json = mapper.writeValueAsString(info);

            redisTemplate.opsForValue().set(key, json, 5, TimeUnit.SECONDS);

            log.debug("재연결 정보 저장: userId={}, roomId={}", userId, info.getRoomId());
        } catch (Exception e) {
            log.error("재연결 정보 저장 실패: userId={}", userId, e);
        }
    }

    //재연결 정보 조회
    public DisconnectInfo getDisconnectInfo(Long userId) {
        try {
            String key = "reconnect:" + userId;
            String json = (String) redisTemplate.opsForValue().get(key);

            if (json == null) {
                return null;
            }

            return mapper.readValue(json, DisconnectInfo.class);
        } catch (Exception e) {
            log.error("재연결 정보 조회 실패: userId={}", userId, e);
            return null;
        }
    }

    // 재연결 정보 삭제 (재연결 성공 시)
    public void deleteDisconnectInfo(Long userId) {
        try {
            String key = "reconnect:" + userId;
            redisTemplate.delete(key);

            log.debug("재연결 정보 삭제: userId={}", userId);
        } catch (Exception e) {
            log.error("재연결 정보 삭제 실패: userId={}", userId, e);
        }
    }



    private Long getLong(Map<Object, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) return null;
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }


}
