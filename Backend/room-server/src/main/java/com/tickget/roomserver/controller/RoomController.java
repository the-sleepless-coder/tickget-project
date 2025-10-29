package com.tickget.roomserver.controller;

import com.tickget.roomserver.dto.request.CreateRoomRequest;
import com.tickget.roomserver.dto.response.CreateRoomResponse;
import com.tickget.roomserver.dto.response.RoomResponse;
import com.tickget.roomserver.service.RoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@RestController
@RequestMapping("rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    //방 목록 및 상태 조회
    @GetMapping
    public ResponseEntity<Slice<RoomResponse>> getRooms(
            @PageableDefault(size = 12, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable){

        Slice<RoomResponse> responses = roomService.getRooms(pageable);

        return ResponseEntity.ok()
                .body(responses);
    }

    // 특정 방 상세 정보 조회
    @GetMapping("/{roomId}")
    public ResponseEntity<RoomResponse> getRoom(@PathVariable("roomId") Long roomId){
        RoomResponse response = roomService.getRoom(roomId);
        return ResponseEntity.ok()
                .body(response);
    }

    // 방 멤버리스트 조회
    @GetMapping("/{roomId}/members")
    public ResponseEntity<?> getRoomMembers(@PathVariable("roomId") Long roomId){
        return ResponseEntity.ok().build();
    }

    // 방생성
    @PostMapping
    public ResponseEntity<CreateRoomResponse> createRoom(@RequestBody CreateRoomRequest createRoomRequest,
                                                         @RequestPart(value = "file", required = false) MultipartFile thumbnail){
        CreateRoomResponse response = roomService.createRoom(createRoomRequest,thumbnail);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    // 방 세팅 변경 -> 매치 서버에서 변경하면 됨. 불필요.
//    @PatchMapping("/{roomId}/settings")
//    public ResponseEntity<?> changeRoomSetting(@PathVariable("roomId") String roomId){
//        return ResponseEntity.ok().build();
//    }

    // 방 입장
    @PostMapping("/{roomId}/join")
    public ResponseEntity<?> joinRoom(@PathVariable("roomId") Long roomId){
        return ResponseEntity.ok().build();
    }

    //방 퇴장 -> 방에 아무도 존재하지 않으면 삭제.
    @DeleteMapping("/{roomId}/exit")
    public ResponseEntity<?> exitRoom(@PathVariable("roomId") Long roomId){
        return ResponseEntity.ok().build();
    }




}
