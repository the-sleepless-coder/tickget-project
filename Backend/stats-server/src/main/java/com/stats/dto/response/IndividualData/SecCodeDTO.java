package com.stats.dto.response;

import com.stats.entity.UserStats;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SecCodeDTO {
    private LocalDateTime date;
    private float selectTime;
    //private int backSpace;
    //private int missCount;

    public static SecCodeDTO dtobuild(UserStats userStats){
        return SecCodeDTO.builder()
                .date(userStats.getCreatedAt())
                .selectTime(userStats.getSeccodeSelectTime())
                .build();
    }
}
