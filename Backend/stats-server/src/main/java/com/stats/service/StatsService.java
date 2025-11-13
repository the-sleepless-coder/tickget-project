package com.stats.service;

import com.stats.dto.response.*;
import com.stats.entity.User;
import com.stats.entity.UserStats;
import com.stats.repository.UserRepository;
import com.stats.repository.UserStatsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class StatsService {
    private final UserRepository userRepository;
    private final UserStatsRepository userStatsRepository;

    // 사용자 정보를 가져온다.
    public Object getUserInfo(Long userIdLong){
        Optional<User> userData = userRepository.findById(userIdLong);

        User user = new User();
        // UserDTO userDTO  = UserDTO.dtobuild();

        return user;
    }

    public Object getDurationInfo(Long userIdLong){

        List<UserStats> top12UserStats = userStatsRepository.findTop12ByUserIdOrderByCreatedAtDesc(userIdLong);

        List<QueueSelectDTO> queueDtoList = new ArrayList<>();
        List<SecCodeDTO> secDtoList = new ArrayList<>();
        List<SeatSelectDTO> seatDtoList = new ArrayList<>();

        if(!top12UserStats.isEmpty()){
            for(UserStats userdata: top12UserStats){

               // 알아서 맛있게 필요한 정보 다 넣어준다~
               QueueSelectDTO queueDto = QueueSelectDTO.dtobuild(userdata);

               SecCodeDTO secDto = SecCodeDTO.dtobuild(userdata);

               SeatSelectDTO seatDto = SeatSelectDTO.dtobuild(userdata);

               queueDtoList.add(queueDto);
               secDtoList.add(secDto);
               seatDtoList.add(seatDto);

            }
        }

        ClickStatsDTO clickStats = new ClickStatsDTO(queueDtoList, secDtoList, seatDtoList);

        return clickStats;

    }

    // User 상세 기록 가져오기
    public Object getSpecificUserStats(Long userIdLong){
        // 개인/대결 5명씩 -> 총 10명
        List<SpecificStatsDTO> userStats = userStatsRepository.findSpecificStatsWithRoom(userIdLong);

        if(userStats.isEmpty()){
            return null;
        }

        return userStats;

        /**
         List<UserStats> top5UserStats = userStatsRepository.findTop5ByUserIdOrderByCreatedAtDesc(userIdLong);
         List<SpecificStatsDTO> specificList = new ArrayList<>();
         if(!top5UserStats.isEmpty()){
         for(UserStats userdata: top5UserStats){
         SpecificStatsDTO stats = SpecificStatsDTO.dtobuilder(userdata);

         specificList.add(stats);
         }
         }
         */
    }

}
