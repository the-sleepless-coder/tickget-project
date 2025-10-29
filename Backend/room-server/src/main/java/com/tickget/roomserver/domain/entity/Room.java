package com.tickget.roomserver.domain.entity;

import com.tickget.roomserver.domain.enums.HallType;
import com.tickget.roomserver.domain.enums.RoomStatus;
import com.tickget.roomserver.domain.enums.RoomType;
import com.tickget.roomserver.dto.request.CreateRoomRequest;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Room extends BaseTimeEntity{

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_type")
    private RoomType roomType;

    @Column(name = "hall_id")
    private Long hallId;

    @Column(name = "hall_type")
    private HallType hallType;

    @Column(name = "bot_count")
    private int botCount;

    @Column(name = "total_seat")
    private int totalSeat;

    @Column(name = "max_booking")
    @ColumnDefault("2") // 기본 인당 2매
    private int maxBooking;

    private RoomStatus status;

    @Column(name = "thumbnail_url", length = 500)
    private String thumbnailUrl;

    public static Room of (CreateRoomRequest createRoomRequest) {
        return Room.builder()
                .roomType(createRoomRequest.getRoomType())
                .hallId(createRoomRequest.getHallId())
                .hallType(createRoomRequest.getHallType())
                .botCount(createRoomRequest.getBotCount())
                .totalSeat(createRoomRequest.getTotalSeat())
                .status(RoomStatus.READY)
                .thumbnailUrl("") //TODO: 썸네일 관련 로직은 얘기해보고 추가 구현
                .build();
    }


}
