package com.tickget.roomserver.domain.entity;

import com.tickget.roomserver.domain.enums.HallSize;
import com.tickget.roomserver.domain.enums.HallType;
import com.tickget.roomserver.domain.enums.RoomStatus;
import com.tickget.roomserver.domain.enums.RoomType;
import com.tickget.roomserver.domain.enums.ThumbnailType;
import com.tickget.roomserver.dto.request.CreateRoomRequest;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "rooms")
public class Room extends BaseTimeEntity{

    static final String TSX_DEFAULT ="default";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_type")
    @Enumerated(EnumType.STRING)
    private RoomType roomType;

    @Column(name = "hall_id")
    private Long hallId;

    @Column(name = "hall_name")
    private String hallName;

    @Column(name = "hall_size")
    @Enumerated(EnumType.STRING)
    private HallSize hallSize;

    @Column(name = "is_ai_generated")
    private boolean isAIGenerated;

    @Column(name = "total_seat")
    private int totalSeat;

    @Column(name = "bot_count")
    private int botCount;

    @Column(name = "max_booking")
    @ColumnDefault("2") // 기본 인당 2매
    private int maxBooking;

    @Enumerated(EnumType.STRING)
    private RoomStatus status;

    @Column(name ="thumbnail_type")
    @Enumerated(EnumType.STRING)
    private ThumbnailType thumbnailType;

    @Column(name = "thumbnail_value", length = 500)
    private String thumbnailValue;

    @Column(name = "tsx_url", length = 500)
    private String tsxUrl;

    public static Room of (CreateRoomRequest createRoomRequest,PresetHall hall, String thumbnailValue ) {
        return Room.builder()
                .roomType(createRoomRequest.getRoomType())
                .hallId(createRoomRequest.getHallId())
                .hallSize(hall.getSize())
                .hallName(hall.getName())
                .isAIGenerated(createRoomRequest.getHallType() == HallType.AI_GENERATED)
                .botCount(createRoomRequest.getBotCount())
                .totalSeat(createRoomRequest.getTotalSeat())
                .status(RoomStatus.WAITING)
                .thumbnailType(createRoomRequest.getThumbnailType())
                .thumbnailValue(thumbnailValue)
                .tsxUrl(createRoomRequest.getTsxUrl()==null?TSX_DEFAULT:createRoomRequest.getTsxUrl())
                .build();
    }


}
