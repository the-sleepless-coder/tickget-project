package com.stats.service;

import com.stats.dto.response.*;
import com.stats.entity.Room;
import com.stats.entity.User;
import com.stats.entity.UserStats;
import com.stats.repository.UserRepository;
import com.stats.repository.UserStatsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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

    private static final Integer USER_SPECIFICS_PAGE_NUM = 5;
    private static final Integer MATCH_DATA_PAGE_NUM = 25;

    // 사용자 정보를 가져온다.
    public Object getUserInfo(Long userIdLong){
        Optional<User> userData = userRepository.findById(userIdLong);

        User user = new User();
        // UserDTO userDTO  = UserDTO.dtobuild();

        return user;
    }

    // User 랭킹 정보, 소요 시간 정보, 상세 기록 정보 가져오기.
    public MyPageDTO getMyPageInfo(Long userIdLong, int page){

        ClickStatsDTO clickstats = getDurationInfo(userIdLong);

        List<SpecificStatsDTO> specifics = getSpecificUserStats(userIdLong, page);

        MyPageDTO myPageInfo =MyPageDTO.dtobuilder(userIdLong, clickstats, specifics);

        return myPageInfo;
    }

    // 소요 시간 정보를 가져온다.
    public ClickStatsDTO getDurationInfo(Long userIdLong){

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
    public List<SpecificStatsDTO> getSpecificUserStats(Long userIdLong, int page){
        Pageable top5 = PageRequest.of(page,USER_SPECIFICS_PAGE_NUM);

        Room.RoomType SOLO = Room.RoomType.SOLO;
        Room.RoomType MULTI = Room.RoomType.MULTI;

        List<SpecificStatsDTO> resultdata = new ArrayList<>();

        // Solo && Multi 데이터 기준으로 5개씩 뽑아서 가져온다.
        List<SpecificStatsDTO> solodata = userStatsRepository.findSpecificStatsWithRoom(userIdLong, SOLO, top5);
        List<SpecificStatsDTO> multidata = userStatsRepository.findSpecificStatsWithRoom(userIdLong, MULTI, top5);

        if(solodata.isEmpty() && multidata.isEmpty()){
            return null;
        }
        // 개인/대결 5명씩 -> 총 10명
        for(SpecificStatsDTO solo: solodata){
            resultdata.add(solo);
        }

        for(SpecificStatsDTO multi:multidata){
            resultdata.add(multi);
        }

        resultdata.sort((SpecificStatsDTO d1, SpecificStatsDTO d2)-> d2.getDate().compareTo(d1.getDate()));

        return resultdata;
    }

    /**
     * 경기 기록 관련 데이터
     * 캐싱 전략은 일단 코드 다 짜고 나서, 재도입
     * */
    public List<MatchInfoStatsDTO> getMatchInfoStats(Long userId, int page){
        Pageable top25 = PageRequest.of(page, MATCH_DATA_PAGE_NUM);

        Room.RoomType SOLO = Room.RoomType.SOLO;
        Room.RoomType MULTI = Room.RoomType.MULTI;
        List<MatchInfoStatsDTO> solodata =  userStatsRepository.findMatchInfoStatsByUserId(userId, SOLO, top25);
        List<MatchInfoStatsDTO> multidata = userStatsRepository.findMatchInfoStatsByUserId(userId, MULTI, top25);

        if( solodata.isEmpty() && multidata.isEmpty() ){
            return null;
        }

        List<MatchInfoStatsDTO> resultData = new ArrayList<>();
        for(MatchInfoStatsDTO solo: solodata){
            resultData.add(solo);
        }

        for(MatchInfoStatsDTO multi:multidata){
            resultData.add(multi);
        }

        return resultData;
    }

}
