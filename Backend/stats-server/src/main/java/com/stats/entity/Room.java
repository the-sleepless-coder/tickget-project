package com.stats.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "rooms")
public class Room extends BaseTimeEntity{

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

    public enum RoomType {
        SOLO,
        MULTI
    }

    public enum HallSize{
        PRESET,
        AI_GENERATED
    }

    public enum RoomStatus{
        WAITING,
        PLAYING,
        CLOSED
    }

    public enum ThumbnailType{
        PRESET
        ,UPLOADED
    }



}
