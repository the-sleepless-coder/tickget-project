package com.tickget.roomserver.dto.response;

import com.tickget.roomserver.domain.entity.Room;
import com.tickget.roomserver.domain.enums.RoomStatus;
import java.util.List;
import java.util.Map;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class JoinRoomResponse {
    private Long roomId;
    private int currentUserCount;
    private Map<Long, String> user ; // id:name
    private RoomStatus roomStatus;
    private String subscriptionTopic;

    public static JoinRoomResponse of (Room room, int currentUserCount , Map<Long, String> user){

        return JoinRoomResponse.builder()
                .roomId(room.getId())
                .currentUserCount(currentUserCount)
                .subscriptionTopic("/topic/rooms/" + room.getId())
                .user(user)
                .roomStatus(room.getStatus())
                .build();

    }
}
