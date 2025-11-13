package com.stats.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "preset_halls")
public class PresetHall extends BaseTimeEntity{

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(name = "size")
    @Enumerated(EnumType.STRING)
    private HallSize size;

    @Column(name = "total_seat")
    private int totalSeat;

    public enum HallSize {
        SMALL,
        MEDIUM,
        LARGE;




        public static HallSize get(int totalSeat) {
            if (totalSeat < 1000 )
                return HallSize.SMALL;
            else if (totalSeat < 10000 )
                return HallSize.MEDIUM;
            else
                return HallSize.LARGE;
        }
    }


}


