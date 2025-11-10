package com.tickget.roomserver.dto.response;

import com.tickget.roomserver.domain.entity.Room;
import com.tickget.roomserver.domain.enums.RoomStatus;

import java.util.List;

import com.tickget.roomserver.dto.cache.RoomMember;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JoinRoomResponse {
    private Long roomId;
    private Long matchId;
    private int currentUserCount;
    private List<RoomMember> roomMembers ; // id:name
    private RoomStatus roomStatus;
    private String subscriptionTopic;

    public static JoinRoomResponse of (Room room, int currentUserCount , List<RoomMember> roomMembers, Long matchId) {

        return JoinRoomResponse.builder()
                .roomId(room.getId())
                .matchId(matchId)
                .currentUserCount(currentUserCount)
                .subscriptionTopic("/topic/rooms/" + room.getId())
                .roomMembers(roomMembers)
                .roomStatus(room.getStatus())
                .build();

    }
}
