package com.tickget.roomserver.domain.entity;

import com.tickget.roomserver.domain.enums.HallSize;
import com.tickget.roomserver.domain.enums.HallType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "prset_halls")
public class PresetHall extends BaseTimeEntity{

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(name = "size")
    private HallSize size;

    @Column(name = "total_seat")
    private int totalSeat;

}
