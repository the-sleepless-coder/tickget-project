package com.tickget.roomserver.dto.response;

import com.tickget.roomserver.domain.entity.Room;
import com.tickget.roomserver.domain.enums.RoomStatus;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExitRoomResponse {
    private Long roomId;
    private int leftUserCount;
    private RoomStatus roomStatus;

    public static ExitRoomResponse of (Room room, int leftUserCount){
        return ExitRoomResponse.builder()
                .roomId(room.getId())
                .leftUserCount(leftUserCount)
                .roomStatus(room.getStatus())
                .build();
    }
}
