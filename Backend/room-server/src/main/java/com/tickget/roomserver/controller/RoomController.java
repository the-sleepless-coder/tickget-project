package com.tickget.roomserver.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("rooms")
@RequiredArgsConstructor
public class RoomController {

    //방 목록 및 상태 조회
    @GetMapping
    public ResponseEntity<?> getRooms(){
        return ResponseEntity.ok().build();
    }

    // 특정 방 상세 정보 조회
    @GetMapping("/{roomId}")
    public ResponseEntity<?> getRoom(@PathVariable("roomId") String roomId){
        return ResponseEntity.ok().build();
    }

    // 방 멤버리스트 조회
    @GetMapping("/{roomId}/members")
    public ResponseEntity<?> getRoomMembers(@PathVariable("roomId") String roomId){
        return ResponseEntity.ok().build();
    }

    // 방생성
    @PostMapping
    public ResponseEntity<?> createRoom(){
        return ResponseEntity.ok().build();
    }

    // 방 세팅 변경
    @PatchMapping("/{roomId}/settings")
    public ResponseEntity<?> changeRoomSetting(@PathVariable("roomId") String roomId){
        return ResponseEntity.ok().build();
    }

    // 방 입장
    @PostMapping("/{roomId}/join")
    public ResponseEntity<?> joinRoom(@PathVariable("roomId") String roomId){
        return ResponseEntity.ok().build();
    }

    //방 퇴장 -> 방에 아무도 존재하지 않으면 삭제.
    @DeleteMapping("/{roomId}/exit")
    public ResponseEntity<?> exitRoom(@PathVariable("roomId") String roomId){
        return ResponseEntity.ok().build();
    }




}
