package com.tickget.roomserver.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.tickget.roomserver.domain.entity.PresetHall;
import com.tickget.roomserver.domain.entity.Room;
import com.tickget.roomserver.domain.enums.RoomStatus;
import com.tickget.roomserver.domain.repository.PresetHallRepository;
import com.tickget.roomserver.domain.repository.RoomCacheRepository;
import com.tickget.roomserver.domain.repository.RoomRepository;
import com.tickget.roomserver.dto.cache.RoomInfo;
import com.tickget.roomserver.dto.cache.RoomInfoUpdate;
import com.tickget.roomserver.dto.cache.RoomMember;
import com.tickget.roomserver.dto.request.CreateMatchRequest;
import com.tickget.roomserver.dto.request.CreateRoomRequest;
import com.tickget.roomserver.dto.request.ExitRoomRequest;
import com.tickget.roomserver.dto.request.JoinRoomRequest;
import com.tickget.roomserver.dto.request.MatchSettingUpdateRequest;
import com.tickget.roomserver.dto.request.NotifyRoomLeftRequest;
import com.tickget.roomserver.dto.response.CreateRoomResponse;
import com.tickget.roomserver.dto.response.ExitRoomResponse;
import com.tickget.roomserver.dto.response.JoinRoomResponse;
import com.tickget.roomserver.dto.response.MatchResponse;
import com.tickget.roomserver.dto.response.RoomDetailResponse;
import com.tickget.roomserver.dto.response.RoomResponse;
import com.tickget.roomserver.event.HostChangedEvent;
import com.tickget.roomserver.event.RoomPlayingEndedEvent;
import com.tickget.roomserver.event.RoomPlayingStartedEvent;
import com.tickget.roomserver.event.UserJoinedRoomEvent;
import com.tickget.roomserver.event.UserLeftRoomEvent;
import com.tickget.roomserver.exception.CreateMatchDeclinedException;
import com.tickget.roomserver.exception.CreateMatchFailedException;
import com.tickget.roomserver.exception.PresetHallNotFoundException;

import com.tickget.roomserver.exception.RoomClosedException;
import com.tickget.roomserver.exception.RoomFullException;
import com.tickget.roomserver.exception.RoomNotFoundException;
import com.tickget.roomserver.exception.RoomPlayingException;
import com.tickget.roomserver.kafka.RoomEventProducer;
import com.tickget.roomserver.session.WebSocketSessionManager;

import java.util.*;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoomService {

    private final TicketingServiceClient  ticketingServiceClient;
    private final WebSocketSessionManager sessionManager;
    private final RoomEventProducer roomEventProducer;
    private final RoomCacheRepository roomCacheRepository;
    private final RoomRepository roomRepository;
    private final PresetHallRepository  presetHallRepository;

    @Transactional
    public CreateRoomResponse createRoom(CreateRoomRequest request ) throws JsonProcessingException {

        log.info("사용자  {}(id:{})(이)가 방 생성 요청",request.getUsername(), request.getUserId());
        
        PresetHall presetHall = presetHallRepository.findById(request.getHallId()).orElseThrow(
                () -> new PresetHallNotFoundException(request.getHallId()));

        Room room = Room.of(request,presetHall);
        room = roomRepository.save(room); // 알아서 id값 반영되지만 명시
        String sessionId = sessionManager.getSessionIdByUserId(request.getUserId());

        try {
            // Redis에 정보 저장
            roomCacheRepository.saveRoom(room.getId(), request);
            roomCacheRepository.addMemberToRoom(room.getId(), request.getUserId(), request.getUsername(), request.getProfileImageUrl());

            // 세션에 방 정보 등록
            if (sessionId != null) {
                sessionManager.joinRoom(sessionId, room.getId());
            }

            // 매치 생성 요청
            MatchResponse matchResponse = ticketingServiceClient.createMatch(CreateMatchRequest.of(request, room.getId()));

            // 매치의 startTime을 Redis에 업데이트
            if (matchResponse != null && matchResponse.getStartTime() != null) {
                roomCacheRepository.updateStartTime(room.getId(), matchResponse.getStartTime());
            }

            log.info("사용자 {}(id:{})이(가) 방 {}을 생성 후 입장",
                    request.getUsername(), request.getUserId(), room.getId());

            return CreateRoomResponse.of(room, matchResponse.getMatchId());

        } catch (CreateMatchFailedException | CreateMatchDeclinedException e) {
            log.error("방 생성 중 매치 생성 실패 - roomId: {}, userId: {}, error: {}",
                    room.getId(), request.getUserId(), e.getMessage());

            roomCacheRepository.removeMemberFromRoom(room.getId(), request.getUserId());
            roomCacheRepository.deleteRoom(room.getId());

            if (sessionId != null) {
                sessionManager.leaveRoom(sessionId);
            }

            throw e;
        }
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
            roomInfoMap.put(roomId, roomCacheRepository.getRoomInfo(roomId));
        }

        // 3. map으로 일괄로 변환
        return rooms.map(room ->
                        RoomResponse.of(
                                room,
                                roomInfoMap.get(room.getId())
                        ));
    }

    @Transactional(readOnly = true)
    public RoomDetailResponse getRoom(Long roomId) throws JsonProcessingException {
        Room room = roomRepository.findById(roomId).orElseThrow(
                () -> new RoomNotFoundException(roomId));

        //우선 매치서버에서 받아오는것이 아닌, redis 사용하는 방식으로 사용
        RoomInfo roomInfo = roomCacheRepository.getRoomInfo(roomId);
        List<RoomMember> roomMembers = roomCacheRepository.getRoomMembers(roomId);

        return RoomDetailResponse.of(room, roomInfo,roomMembers);
    }

    @Transactional(readOnly = true)
    public JoinRoomResponse joinRoom(JoinRoomRequest joinRoomRequest, Long roomId) throws JsonProcessingException {
        Long userId = joinRoomRequest.getUserId();
        String userName = joinRoomRequest.getUserName();

        log.info("사용자  {}(id:{})(이)가 방 {}에 입장 요청",userName, userId, roomId);
        
        Room room = roomRepository.findById(roomId).orElseThrow(
                () -> new RoomNotFoundException(roomId));

        validateRoomAvailable(roomId);



        int currentUserCount = roomCacheRepository.addMemberToRoom(roomId, userId, userName, joinRoomRequest.getProfileImageUrl());

        String sessionId = sessionManager.getSessionIdByUserId(userId);
        if (sessionId != null) {
            sessionManager.joinRoom(sessionId, roomId);
        }

        List<RoomMember> roomMembers = roomCacheRepository.getRoomMembers(roomId);
        Long matchId = roomCacheRepository.getMatchIdByRoomId(roomId);

        log.info("사용자  {}(id:{})(이)가 방 {}(매치 {} 대기 중)에 입장 성공 - 현재 인원: {}",userName, userId, roomId,matchId, currentUserCount);

        UserJoinedRoomEvent event = UserJoinedRoomEvent.of(userId,userName, roomId, currentUserCount);
        roomEventProducer.publishUserJoinedEvent(event);



        return JoinRoomResponse.of(room, currentUserCount, roomMembers,matchId);

    }

    private void validateRoomAvailable(Long roomId) {
        RoomInfo roomInfo = roomCacheRepository.getRoomInfo(roomId);

        if (roomInfo == null) {
            throw new RoomNotFoundException(roomId);
        }

        Room room = roomRepository.findById(roomId).orElseThrow(
                () -> new RoomNotFoundException(roomId));

        RoomStatus roomStatus = room.getStatus();

        if (roomStatus == RoomStatus.PLAYING) {
            log.info("방 {} : 현재 게임이 진행중이어서 입장 불가",room.getId());
            throw new RoomPlayingException("게임이 진행중이여서 입장할 수 없는 방입니다");
        }
        if (roomStatus == RoomStatus.CLOSED) {
            log.info("방 {} : 이미 종료된 방이어서 입장 불가",room.getId());
            throw new RoomClosedException("이미 종료된 방에는 참가할 수 없습니다.");
        }

        Integer maxUserCount = roomInfo.getMaxUserCount();
        Integer currentCount = roomCacheRepository.getRoomCurrentUserCount(roomId);
        if (Objects.equals(currentCount, maxUserCount)) {
            throw new RoomFullException(roomId, maxUserCount);
        }
    }

    @Transactional
    public ExitRoomResponse exitRoom(ExitRoomRequest exitRoomRequest, Long roomId) {
        Long userId = exitRoomRequest.getUserId();
        String userName = exitRoomRequest.getUserName();

        Room room = roomRepository.findById(roomId).orElseThrow(
                () -> new RoomNotFoundException(roomId));

        RoomInfo roomInfo = roomCacheRepository.getRoomInfo(roomId);
        boolean isHost = roomInfo.getHostId().equals(userId);

        roomCacheRepository.removeMemberFromRoom(roomId, userId);
        if (room.getStatus() == RoomStatus.PLAYING) {
            notifyUserLeftRoom(roomId, userId);
        }


        String sessionId = sessionManager.getSessionIdByUserId(userId);
        if (sessionId != null) {
            sessionManager.leaveRoom(sessionId);
        }

        int leftUserCount = roomCacheRepository.getRoomCurrentUserCount(roomId);
        log.info("사용자 {}(id:{})(이)가 방 {}에서 퇴장 - 현재 잔존 인원: {}",userName,userId,roomId,leftUserCount);

        String newHostId = null;
        if (isHost && leftUserCount > 0) {
            newHostId = roomCacheRepository.transferHost(roomId);
            log.info("방 {}의 호스트 변경: 기존={}, 새로운={}", roomId, userId, newHostId);

            HostChangedEvent hostEvent = HostChangedEvent.of(roomId, newHostId, userId);
            roomEventProducer.publishHostChangedEvent(hostEvent);
        }

        UserLeftRoomEvent event = UserLeftRoomEvent.of(userId, roomId, leftUserCount);
        roomEventProducer.publishUserLeftEvent(event);

        // 마지막 유저가 나갔으면 방 닫음
        if (leftUserCount == 0) {
            log.info("방 {} 종료 (인원 0명)", roomId);
            room.setStatus(RoomStatus.CLOSED);
            roomCacheRepository.deleteRoom(roomId);
        }

        return ExitRoomResponse.of(room, leftUserCount);
    }

    private void notifyUserLeftRoom(Long roomId, Long userId) {
        ticketingServiceClient.notifyUserLeftRoom(NotifyRoomLeftRequest.of(roomId, userId));
    }

    @Transactional
    public void startRoomMatch(Long roomId) {
        Room room = roomRepository.findById(roomId).orElseThrow(
                () -> new RoomNotFoundException(roomId));

        room.setStatus(RoomStatus.PLAYING);
        roomEventProducer.publishRoomPlayingStartedEvent(RoomPlayingStartedEvent.builder().roomId(roomId).build());
        log.debug("방 {}에서 매치 시작. status를 {} 로 변경", roomId, room.getStatus());
    }

    @Transactional
    public void endRoomMatch(Long roomId) {
        Room room = roomRepository.findById(roomId).orElseThrow(
                () -> new RoomNotFoundException(roomId));

        room.setStatus(RoomStatus.WAITING);
        roomEventProducer.publishRoomPlayingEndedEvent(RoomPlayingEndedEvent.builder().roomId(roomId).build());
        log.debug("방 {}에서 매치 종료. status를 {} 로 변경", roomId, room.getStatus());
    }

    public void updateMatchSetting(MatchSettingUpdateRequest request) {
        log.debug("매치 설정 변경 : 방={}, 난이도={}, 최대인원={}",
                request.getRoomId(), request.getDifficulty(), request.getMaxUserCount());

        try {
            // 1. Redis 업데이트 (하나의 서버만 실행)
            RoomInfoUpdate infoUpdate = RoomInfoUpdate.from(request);
            roomCacheRepository.updateRoomInfo(infoUpdate);
            log.debug("Redis 방 정보 업데이트 완료: 방={}",  request.getRoomId());

            // 2. 다시 발행 (모든 서버가 구독하도록)
            roomEventProducer.publishRoomSettingUpdatedEvent(request);
            log.debug("방 설정 업데이트 이벤트 재발행: 방={}", request.getRoomId());

        } catch (Exception e) {
            log.error("매치 설정 변경 이벤트 처리 중 오류: 방={}, error={}",
                    request.getRoomId(), e.getMessage(), e);
        }
    }
}
