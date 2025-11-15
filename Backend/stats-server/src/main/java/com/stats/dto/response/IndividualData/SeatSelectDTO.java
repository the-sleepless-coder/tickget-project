package com.stats.dto.response;

import com.stats.entity.UserStats;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SeatSelectDTO {
    private LocalDateTime date;
    private float selectTime;
    // private int missCount;

    public static SeatSelectDTO dtobuild(UserStats userStats){
        return SeatSelectDTO.builder()
                .date(userStats.getCreatedAt())
                .selectTime(userStats.getSeatSelectTime())
                .build();

    }

}
