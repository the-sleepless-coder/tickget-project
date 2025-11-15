package com.stats.dto.response;

import com.stats.entity.User;
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
public class QueueSelectDTO {
    private LocalDateTime date;
    private float clickTime;
    //private int missCount;

    public static QueueSelectDTO dtobuild(UserStats userStats){
        return QueueSelectDTO.builder()
                .date(userStats.getCreatedAt())
                .clickTime(userStats.getDateSelectTime())
                .build();
    }


}
