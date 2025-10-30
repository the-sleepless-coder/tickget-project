package com.tickget.roomserver.service;

import com.tickget.roomserver.domain.entity.PresetHall;
import com.tickget.roomserver.domain.entity.Room;
import com.tickget.roomserver.domain.enums.RoomStatus;
import com.tickget.roomserver.domain.enums.ThumbnailType;
import com.tickget.roomserver.domain.repository.PresetHallRepository;
import com.tickget.roomserver.domain.repository.RoomRepository;
import com.tickget.roomserver.dto.request.CreateRoomRequest;
import com.tickget.roomserver.dto.request.JoinRoomRequest;
import com.tickget.roomserver.dto.response.CreateRoomResponse;
import com.tickget.roomserver.dto.response.JoinRoomResponse;
import com.tickget.roomserver.dto.response.MatchResponse;
import com.tickget.roomserver.dto.response.RoomDetailResponse;
import com.tickget.roomserver.dto.response.RoomResponse;
import com.tickget.roomserver.event.UserJoinedRoomEvent;
import com.tickget.roomserver.exception.PresetHallNotFoundException;

import com.tickget.roomserver.exception.RoomNotFoundException;
import com.tickget.roomserver.kafaka.RoomEventProducer;
import com.tickget.roomserver.session.WebSocketSessionManager;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomRepository roomRepository;
    private final PresetHallRepository  presetHallRepository;
    private final MinioService minioService;
    private final WebSocketSessionManager sessionManager;
    private final RoomEventProducer roomEventProducer;

    @Transactional
    public CreateRoomResponse createRoom(CreateRoomRequest createRoomRequest, MultipartFile thumbnail) {
        //TODO: AI 생성 맵 추가 시 분기점 구현
        PresetHall presetHall = presetHallRepository.findById(createRoomRequest.getHallId()).orElseThrow(
                () -> new PresetHallNotFoundException(createRoomRequest.getHallId())
        );
        String thumbnailValue = createRoomRequest.getThumbnailValue();
        if (createRoomRequest.getThumbnailType() == ThumbnailType.UPLOADED) {
            thumbnailValue = minioService.uploadFile(thumbnail);
        }

        Room room = Room.of(createRoomRequest,presetHall,thumbnailValue);
        room = roomRepository.save(room); // 알아서 id값 반영되지만 명시
        //TODO: 매치 생성 요청


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

        //TODO: 각 방 유저 수 반환 로직 도입
        //TODO: 매치에 대한 정보 배치 요청
        //Map<Long, MatchResponse> matchMap = getMatchResponses(roomIds);
        //Map<Long, Integer> userCountMap = getCurrentUserCounts(roomIds);
        Map<Long, MatchResponse> matchMap = new HashMap<>(roomIds.size());
        Map<Long, Integer> userCountMap = new HashMap<>(roomIds.size());

        // 3. map으로 일괄로 변환
        return rooms.map(room ->
                        RoomResponse.of(
                                room,
                                matchMap.get(room.getId()),
                                userCountMap.get(room.getId())
                        ));
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
    public JoinRoomResponse joinRoom(JoinRoomRequest joinRoomRequest, Long roomId) {
        Long userId = joinRoomRequest.getUserId();
        String userName = joinRoomRequest.getUserName();

        Room room = roomRepository.findById(roomId).orElseThrow(
                () -> new RoomNotFoundException(roomId));

        RoomStatus roomStatus = room.getStatus();

        if (roomStatus == RoomStatus.PLAYING) {
            throw new IllegalArgumentException("게임이 진행중이여서 입장할 수 없는 방입니다");
        }
        if (roomStatus == RoomStatus.CLOSED) {
            throw new IllegalStateException("이미 종료된 방에는 참가할 수 없습니다.");
        }

        Map<Long,String> users = sessionManager.getUsersInRoom(roomId);
        //TODO: 로직 변경해서 room에서 최대 인원수를 들고 있게 한 후, 이를 기반으로 요청 거절

        sessionManager.addUserToRoom(userId,userName,roomId);
        users.put(userId,userName);
        int currentUserCount = users.size();
        log.debug("사용자  {}(id:{})(이)가 방 {}에 입장 - 현재 인원: {}",userName, userId, roomId, currentUserCount);

        UserJoinedRoomEvent event = UserJoinedRoomEvent.of(userId, roomId, currentUserCount);
        roomEventProducer.publishUserJoinedEvent(event);

        return JoinRoomResponse.of(room, currentUserCount, users);

    }

}
