package com.stats.dto.response;

import com.stats.entity.Room;
import com.stats.entity.UserStats;
import com.stats.repository.UserRepository;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpecificStatsDTO {
    private LocalDateTime date;
    private Room.RoomType gameType;
    private int totRank;
    private float queueClickTime;
    private float captchaClickTime;
    private float seatClickTime;
    private float totalDuration;


    // Specific Stats Builder
    /**
    public static SpecificStatsDTO dtobuilder(UserStats userStats){
        return SpecificStatsDTO.builder()
                .date(userStats.getCreatedAt())
                .totRank(userStats.getTotalRank())
                .queueClickTime(userStats.getDateSelectTime())
                .captchaClickTime(userStats.getSeccodeSelectTime())
                .seatClickTime(userStats.getSeatSelectTime())
                .totalDuration(userStats.getDateSelectTime()+ userStats.getSeccodeSelectTime()+ userStats.getSeatSelectTime())
                .build();
    }
     */
}
