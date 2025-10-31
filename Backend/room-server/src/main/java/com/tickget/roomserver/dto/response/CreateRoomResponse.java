package com.tickget.roomserver.dto.response;


import com.tickget.roomserver.domain.entity.Room;
import com.tickget.roomserver.domain.enums.HallSize;
import com.tickget.roomserver.domain.enums.RoomType;
import com.tickget.roomserver.domain.enums.ThumbnailType;
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
    private String subscriptionTopic;
    private ThumbnailType thumbnailType;
    private String thumbnailValue;

    public static CreateRoomResponse from(Room room){
        return CreateRoomResponse.builder()
                .roomId(room.getId())
                .roomType(room.getRoomType())
                .hallId(room.getHallId())
                .hallSize(room.getHallSize())
                .totalSeat(room.getTotalSeat())
                .botCount(room.getBotCount())
                .maxBooking(room.getMaxBooking())
                .subscriptionTopic("/topic/rooms/" + room.getId())
                .thumbnailType(room.getThumbnailType())
                .thumbnailValue(room.getThumbnailValue())
                .build();
    }

}
