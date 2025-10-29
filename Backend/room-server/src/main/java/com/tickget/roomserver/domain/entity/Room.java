package com.tickget.roomserver.domain.entity;

import com.tickget.roomserver.domain.enums.HallType;
import com.tickget.roomserver.domain.enums.RoomStatus;
import com.tickget.roomserver.domain.enums.RoomType;
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
public class Room {

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



}
