package com.tickget.roomserver.dto.response;


import com.tickget.roomserver.domain.entity.Room;
import com.tickget.roomserver.domain.enums.HallSize;
import com.tickget.roomserver.domain.enums.RoomType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateRoomResponse {

    private Long roomId;
    private RoomType roomType;
    private Long hallId;
    private HallSize hallSize;
    private int totalSeat;
    private int botCount;
    private int maxBooking;

    public static CreateRoomResponse from(Room room){
        return CreateRoomResponse.builder()
                .roomId(room.getId())
                .roomType(room.getRoomType())
                .hallId(room.getHallId())
                .hallSize(room.getHallSize())
                .totalSeat(room.getTotalSeat())
                .botCount(room.getBotCount())
                .maxBooking(room.getMaxBooking())
                .build();
    }

}
