package com.tickget.roomserver.service;

import com.tickget.roomserver.domain.entity.Room;
import com.tickget.roomserver.domain.repository.RoomRepository;
import com.tickget.roomserver.dto.request.CreateRoomRequest;
import com.tickget.roomserver.dto.response.CreateRoomResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomRepository roomRepository;

    @Transactional
    public CreateRoomResponse createRoom(CreateRoomRequest createRoomRequest) {
        Room room = Room.of(createRoomRequest);
        //TODO: 매치 생성 요청

        room = roomRepository.save(room); // 알아서 id값 반영되지만 명시
        return CreateRoomResponse.of(room);
    }
}
