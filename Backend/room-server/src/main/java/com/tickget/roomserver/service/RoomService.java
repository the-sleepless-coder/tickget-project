package com.tickget.roomserver.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tickget.roomserver.domain.entity.PresetHall;
import com.tickget.roomserver.domain.entity.Room;
import com.tickget.roomserver.domain.enums.RoomStatus;
import com.tickget.roomserver.domain.enums.ThumbnailType;
import com.tickget.roomserver.domain.repository.PresetHallRepository;
import com.tickget.roomserver.domain.repository.RoomRepository;
import com.tickget.roomserver.dto.cache.MemberCache;
import com.tickget.roomserver.dto.cache.RoomInfo;
import com.tickget.roomserver.dto.request.CreateRoomRequest;
import com.tickget.roomserver.dto.request.ExitRoomRequest;
import com.tickget.roomserver.dto.request.JoinRoomRequest;
import com.tickget.roomserver.dto.response.CreateRoomResponse;
import com.tickget.roomserver.dto.response.ExitRoomResponse;
import com.tickget.roomserver.dto.response.JoinRoomResponse;
import com.tickget.roomserver.dto.response.MatchResponse;
import com.tickget.roomserver.dto.response.RoomDetailResponse;
import com.tickget.roomserver.dto.response.RoomResponse;
import com.tickget.roomserver.event.UserJoinedRoomEvent;
import com.tickget.roomserver.event.UserLeftRoomEvent;
import com.tickget.roomserver.exception.PresetHallNotFoundException;

import com.tickget.roomserver.exception.RoomClosedException;
import com.tickget.roomserver.exception.RoomFullException;
import com.tickget.roomserver.exception.RoomNotFoundException;
import com.tickget.roomserver.kafaka.RoomEventProducer;
import com.tickget.roomserver.session.WebSocketSessionManager;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomRepository roomRepository;
    private final PresetHallRepository  presetHallRepository;
    private final RedisTemplate<String,String> redisTemplate;
    private final ObjectMapper mapper = new ObjectMapper();
    private final MinioService minioService;
    private final WebSocketSessionManager sessionManager;
    private final RoomEventProducer roomEventProducer;

    @Transactional
    public CreateRoomResponse createRoom(CreateRoomRequest request, MultipartFile thumbnail) throws JsonProcessingException {

        //TODO: AI 생성 맵 추가 시 분기점 구현
        PresetHall presetHall = presetHallRepository.findById(request.getHallId()).orElseThrow(
                () -> new PresetHallNotFoundException(request.getHallId())
        );
        String thumbnailValue = request.getThumbnailValue();
        if (request.getThumbnailType() == ThumbnailType.UPLOADED) {
            thumbnailValue = minioService.uploadFile(thumbnail);
        }

        Room room = Room.of(request,presetHall,thumbnailValue);
        room = roomRepository.save(room); // 알아서 id값 반영되지만 명시

        //세션에 정보 저장
        sessionManager.addUserToRoom(request.getUserId(), request.getUsername(),room.getId());

        //TODO: 매치 생성 요청

        //Redis에 정보 저장
        String infoKey = "room:" + room.getId()+ ":info";
        String memberKey ="room:" + room.getId()+ ":member";

        Map<String, String> roomInfo = new HashMap<>();
        roomInfo.put("maxUserCount", String.valueOf(request.getMaxUserCount()));
        roomInfo.put("host", String.valueOf(request.getUserId()));
        roomInfo.put("title", request.getMatchName());
        roomInfo.put("difficulty",request.getDifficulty().toString());
        roomInfo.put("createdAt", String.valueOf(System.currentTimeMillis()));

        MemberCache memberCache = new MemberCache(request.getUserId(), request.getUsername(), System.currentTimeMillis());
        String json = mapper.writeValueAsString(memberCache);

        redisTemplate.opsForHash().putAll(infoKey, roomInfo);
        redisTemplate.opsForHash().put(memberKey, request.getUserId(), json);

        redisTemplate.expire(infoKey, 24, TimeUnit.HOURS);
        redisTemplate.expire(memberKey, 24, TimeUnit.HOURS);

        log.debug("사용자  {}(id:{})(이)가 방 {}을 생성 후 입장",request.getUsername(), request.getUserId(), room.getId());



        return CreateRoomResponse.from(room);
    }


    @Transactional(readOnly = true)
    public Slice<RoomResponse> getRooms(Pageable pageable) {
        List<RoomStatus> visibleStatuses =
                List.of(RoomStatus.WAITING, RoomStatus.PLAYING);

        Slice<Room> rooms = roomRepository.findByStatusIn(visibleStatuses, pageable);

        // 1. 모든 room의 ID를 먼저 추출
        List<Long> roomIds = rooms.getContent().stream()
                .map(Room::getId)
                .toList();

        // 관련 정보 Redis를 통해 얻어옴
        Map<Long, RoomInfo> roomInfoMap = new HashMap<>(roomIds.size());
        for (Long roomId : roomIds) {
            roomInfoMap.put(roomId, getRoomInfoByCache(roomId));
        }

        // 3. map으로 일괄로 변환
        return rooms.map(room ->
                        RoomResponse.of(
                                room,
                                roomInfoMap.get(room.getId())
                        ));
    }

    private RoomInfo getRoomInfoByCache(Long roomId) {
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

    @Transactional(readOnly = true)
    public RoomDetailResponse getRoom(Long roomId) {
        Room room = roomRepository.findById(roomId).orElseThrow(
                () -> new RoomNotFoundException(roomId)
        );

        //TODO: 로직 구현 시 대체
        MatchResponse matchResponse = null;
        int currentUserCount = 1;
        List<String> userNames = new ArrayList<>();

        return RoomDetailResponse.of(room, matchResponse, currentUserCount,userNames);
    }

    @Transactional(readOnly = true)
    public JoinRoomResponse joinRoom(JoinRoomRequest joinRoomRequest, Long roomId) throws JsonProcessingException {
        Long userId = joinRoomRequest.getUserId();
        String userName = joinRoomRequest.getUserName();

        Room room = roomRepository.findById(roomId).orElseThrow(
                () -> new RoomNotFoundException(roomId));

        RoomStatus roomStatus = room.getStatus();

        if (roomStatus == RoomStatus.PLAYING) {
            throw new IllegalArgumentException("게임이 진행중이여서 입장할 수 없는 방입니다");
        }
        if (roomStatus == RoomStatus.CLOSED) {
            throw new RoomClosedException("이미 종료된 방에는 참가할 수 없습니다.");
        }

        Map<Long,String> users = sessionManager.getUsersInRoom(roomId);
        validateRoomAvailable(roomId);


        sessionManager.addUserToRoom(userId,userName,roomId);
        users.put(userId,userName);
        int currentUserCount = users.size();

        String memberKey ="room:" + room.getId()+ ":member";

        // cache에 저장
        MemberCache memberCache = new MemberCache(userId, userName, System.currentTimeMillis());
        String json = mapper.writeValueAsString(memberCache);
        redisTemplate.opsForHash().put(memberKey, userId, json);
        redisTemplate.expire(memberKey, 24, TimeUnit.HOURS);

        log.debug("사용자  {}(id:{})(이)가 방 {}에 입장 - 현재 인원: {}",userName, userId, roomId, currentUserCount);

        UserJoinedRoomEvent event = UserJoinedRoomEvent.of(userId, roomId, currentUserCount);
        roomEventProducer.publishUserJoinedEvent(event);

        return JoinRoomResponse.of(room, currentUserCount, users);

    }

    private void validateRoomAvailable(Long roomId) {
        String memberKey ="room:" + roomId+ ":member";
        String infoKey = "room:" + roomId+ ":info";
        Map<Object, Object> info = redisTemplate.opsForHash().entries(infoKey);

        if (info.isEmpty()) {
            throw new RoomNotFoundException(roomId);
        }

        int maxUserCount = (int) info.get("maxUserCount");
        int currentCount = Math.toIntExact(redisTemplate.opsForHash().size(memberKey));
        if (currentCount == maxUserCount ) {
            throw new RoomFullException(roomId, maxUserCount);
        }
    }

    @Transactional
    public ExitRoomResponse exitRoom(ExitRoomRequest exitRoomRequest, Long roomId) {
        Long userId = exitRoomRequest.getUserId();
        String userName = exitRoomRequest.getUserName();

        Room room = roomRepository.findById(roomId).orElseThrow(
                () -> new RoomNotFoundException(roomId));

        if(!sessionManager.getRoomByUser(userId).equals(roomId)){
            throw new IllegalStateException("사용자가 속해있는 방이 아닙니다");
        }

        sessionManager.removeUserFromRoom(userId,roomId);
        int leftUserCount = sessionManager.getUsersInRoom(roomId).size();
        log.debug("사용자 {}(id:{})(이)가 방 {}에서 퇴장 - 현재 잔존 인원: {}",userName,userId,roomId,leftUserCount);

        UserLeftRoomEvent event = UserLeftRoomEvent.of(userId, roomId, leftUserCount);
        roomEventProducer.publishUserLeftEvent(event);

        //TODO: 유저 판단을 다른 서버도 확인하는 로직으로
        // 마지막 유저가 나갔으면 방 닫음
        if (leftUserCount == 0) {
            room.setStatus(RoomStatus.CLOSED);
        }

        return ExitRoomResponse.of(room, leftUserCount);
    }

    private Long getRoomMemberCount(Long roomId) {
        String memberKey = "room:"+roomId+":members";
        return redisTemplate.opsForHash().size(memberKey);
    }
}
