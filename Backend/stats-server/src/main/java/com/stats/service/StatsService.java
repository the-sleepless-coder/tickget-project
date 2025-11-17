package com.stats.service;

import com.stats.dto.response.IndividualData.*;
import com.stats.dto.response.MatchData.MatchDataDTO;
import com.stats.dto.response.MatchData.MatchInfoStatsDTO;
import com.stats.dto.response.MatchData.MatchSpecificsStatsDTO;
import com.stats.dto.response.MatchData.MatchSpecificsStatsDifferenceAddedDTO;
import com.stats.entity.Room;
import com.stats.entity.User;
import com.stats.entity.UserStats;
import com.stats.exception.RoomTypeException;
import com.stats.repository.UserRepository;
import com.stats.repository.UserStatsRepository;
import com.stats.util.StatsCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class StatsService {
    private final UserRepository userRepository;
    private final UserStatsRepository userStatsRepository;

    private static final Integer USER_SPECIFICS_PAGE_NUM = 5;
    private static final Integer MATCH_DATA_PAGE_NUM = 5;

    // 사용자 정보를 가져온다.
    public Object getUserInfo(Long userIdLong){
        Optional<User> userData = userRepository.findById(userIdLong);

        User user = new User();
        // UserDTO userDTO  = UserDTO.dtobuild();

        return user;
    }

    private static float roundTwoDigits(float value) {
        return Math.round(value * 100) / 100.0f;
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
            solo.setTotalDuration(roundTwoDigits(solo.getTotalDuration()));
            resultdata.add(solo);
        }

        for(SpecificStatsDTO multi:multidata){
            multi.setTotalDuration(roundTwoDigits(multi.getTotalDuration()));
            resultdata.add(multi);
        }

        resultdata.sort((SpecificStatsDTO d1, SpecificStatsDTO d2)-> d2.getDate().compareTo(d1.getDate()));

        return resultdata;
    }

    /**
     * 경기 기록 관련 데이터
     * 캐싱 전략은 일단 코드 다 짜고 나서, 재도입
     * 훨씬 더 큰 페이지, Max 단위로 받고
     * 그 뒤에 Redis Cache Hit으로 가져오거나,
     * 없으면 DB에서 가져와서 판단.
     * */
    // Match 관련 정보를 가져온다.
    public List<MatchDataDTO> getMatchDataStats(Long userId, String mode , int page, int size){
        /**
         * 1. 매치 데이터
         * */
        Pageable topN = PageRequest.of(page, size);

        // RoomType 반영
        Object roomType = null;

        mode = mode.trim().toLowerCase();
        // 1. RoomType Exception
        /**
         * Exception 1
         * 모드 유형 존재 안함.
         * */
        if(mode.equals("solo")){
            roomType = Room.RoomType.SOLO;
        }else if(mode.equals("multi")){
            roomType = Room.RoomType.MULTI;
        }else if(mode.equals("all")){
            roomType = "all";
        }else{
            throw new RoomTypeException(mode + "유형이 존재하지 않았습니다.");
        }

        Room.RoomType SOLO = Room.RoomType.SOLO;
        Room.RoomType MULTI = Room.RoomType.MULTI;

        List<MatchDataDTO> matchResults = new ArrayList<>();

        List<MatchInfoStatsDTO> matchData = new ArrayList<>();
        // List<List<MatchSpecificsStatsDTO>> allMatchSpecifics = new ArrayList<>();
        List<List<MatchSpecificsStatsDifferenceAddedDTO>> allMatchSpecificsDifferenceAdded = new ArrayList<>();

        /**
         * Solo, Multi 데이터 처리.
         * */
        if(roomType.equals(Room.RoomType.SOLO) || roomType.equals(Room.RoomType.MULTI)){
            /**
             * 1. 매치 데이터 처리
             * */
            Room.RoomType roomTypeCasted = (Room.RoomType) roomType;
            List<MatchInfoStatsDTO> allMatchData = userStatsRepository.findMatchInfoStatsByUserId(userId, roomTypeCasted, topN);

            /**
             * 데이터 없음.
             * */
            if( allMatchData.isEmpty()){
                return Collections.emptyList();
            }

            /**
             * 2. Match Specifics 관련 데이터
             * */
            Long matchIdLong = 0L;
            for(MatchInfoStatsDTO info: allMatchData){
                matchIdLong = info.getMatchId();
                break;
            }

            if(matchIdLong==0L){
                return Collections.emptyList();
            }

            for(MatchInfoStatsDTO data: allMatchData){
                matchIdLong = data.getMatchId();
                List<MatchSpecificsStatsDTO> matchSpecifics = userStatsRepository.findMatchSpecificInfoStatsByMatchId(matchIdLong, roomTypeCasted, topN);

                // myData 조회.
                MatchSpecificsStatsDTO myData = null;
                for(MatchSpecificsStatsDTO specifics: matchSpecifics){
                    if(userId.equals(specifics.getUserId())){
                        myData = specifics;
                        break;
                    }
                }

                // myData 없을 시 넘어감.
                if (myData == null) {
                    // 로그 남기고
                    log.warn("No stats found for userId {} in match {}", userId, matchIdLong);
                    // 나의 데이터가 없다면 넘어간다.
                    return Collections.emptyList();
                }

                /**
                 * 3. 내 기록 존재할 시,
                 *    내 기록과 상대방 기록 차이 계산
                 * */
                // 내 정보.
                Float myQueueSelectTime = myData.getQueueSelectTimeSafe();
                Integer myQueueMissCount = myData.getQueueMissCountSafe();

                Float myCaptchaSelectTime = myData.getCaptchaSelectTimeSafe();
                Integer myCaptchaBackspaceCount = myData.getCaptchaBackspaceCountSafe();
                Integer myCaptchaTrialCount = myData.getCaptchaTrialCountSafe();

                Float mySeatSelectTime = myData.getSeatSelectTimeSafe();
                Integer mySeatClickMissCount = myData.getSeatSelectClickMissCountSafe();
                Integer mySeatTrialCount = myData.getSeatSelectTrialCountSafe();

                // 다른 사람과의 차이 정보.
                List<MatchSpecificsStatsDifferenceAddedDTO> specificsDiffAdded = new ArrayList<>();
                for(MatchSpecificsStatsDTO specifics: matchSpecifics){
                    Float otherQueueSelectTime = specifics.getQueueSelectTimeSafe();
                    Integer otherQueueMissCount = specifics.getQueueMissCountSafe();

                    Float otherCaptchaSelectTime = specifics.getCaptchaSelectTimeSafe();
                    Integer otherCaptchaBackspaceCount = specifics.getCaptchaBackspaceCountSafe();
                    Integer otherCaptchaTrialCount = specifics.getCaptchaTrialCountSafe();

                    Float otherSeatSelectTime = specifics.getSeatSelectTimeSafe();
                    Integer otherSeatClickMissCount = specifics.getSeatSelectClickMissCountSafe();
                    Integer otherSeatTrialCount = specifics.getSeatSelectTrialCountSafe();

                    Float totalTime = roundTwoDigits(
                            otherQueueSelectTime + otherCaptchaSelectTime + otherSeatSelectTime
                    );

                    Float queueTimeDifference = roundTwoDigits(otherQueueSelectTime - myQueueSelectTime);
                    Integer queueMissCountDifference = otherQueueMissCount - myQueueMissCount;

                    Float captchaTimeDifference = otherCaptchaSelectTime - myCaptchaSelectTime;
                    Integer captchaBackSpaceCountDifference = otherCaptchaBackspaceCount - myCaptchaBackspaceCount;
                    Integer captchaTrialCountDifference = otherCaptchaTrialCount - myCaptchaTrialCount;

                    Float seatSelectTimeDifference = roundTwoDigits(otherSeatSelectTime - mySeatSelectTime);
                    Integer seatClickMissDifference = otherSeatClickMissCount - mySeatClickMissCount;
                    Integer seatTrialCountDifference = otherSeatTrialCount - mySeatTrialCount;

                    MatchSpecificsStatsDifferenceAddedDTO dto =
                            MatchSpecificsStatsDifferenceAddedDTO.dtobuilder(
                                    specifics,                         // @JsonUnwrapped
                                    totalTime,

                                    queueTimeDifference,
                                    queueMissCountDifference,

                                    captchaTimeDifference,
                                    captchaBackSpaceCountDifference,
                                    captchaTrialCountDifference,

                                    seatSelectTimeDifference,
                                    seatClickMissDifference,
                                    seatTrialCountDifference
                            );

                    specificsDiffAdded.add(dto);
                }

                // allMatchSpecifics.add(matchSpecifics);
                allMatchSpecificsDifferenceAdded.add(specificsDiffAdded);
            }

            // matchDataDTO안에 박아서, 리스트에 넣어준다.
            for(int i=0; i < allMatchData.size(); i++){
                MatchInfoStatsDTO info = allMatchData.get(i);
                List<MatchSpecificsStatsDifferenceAddedDTO> specificsDiffAdded = allMatchSpecificsDifferenceAdded.get(i);

                MatchDataDTO dto = MatchDataDTO.dtobuilder(info, specificsDiffAdded);

                matchResults.add(dto);
            }


        }
        else if (roomType.equals("all")) {
            // 1. SOLO / MULTI 각각 가져오기
            List<MatchInfoStatsDTO> soloData =
                    userStatsRepository.findMatchInfoStatsByUserId(userId, SOLO, topN);
            List<MatchInfoStatsDTO> multiData =
                    userStatsRepository.findMatchInfoStatsByUserId(userId, MULTI, topN);

            // 데이터 없음
            if (soloData.isEmpty() && multiData.isEmpty()) {
                return Collections.emptyList();
            }

            // 2. 하나의 리스트로 합치기
            matchData.clear();
            matchData.addAll(soloData);
            matchData.addAll(multiData);

            // 3. 시작 시간 기준 역순 정렬 (최근 경기 우선)
            matchData.sort((m1, m2) -> m2.getStartedAt().compareTo(m1.getStartedAt()));

            // 4. 최대 5개까지만 사용
            if (matchData.size() > 5) {
                matchData = matchData.subList(0, 5);
            }

            // 5. 매치별로 specifics 가져오고, 내 기록 기준으로 차이 계산
            allMatchSpecificsDifferenceAdded.clear();

            for (MatchInfoStatsDTO data : matchData) {
                Long matchIdLong = data.getMatchId();
                Room.RoomType type = data.getRoomType(); // 각 매치에 SOLO/MULTI 들어 있다고 가정

                // 이 매치에 대한 모든 참가자 기록
                List<MatchSpecificsStatsDTO> matchSpecifics =
                        userStatsRepository.findMatchSpecificInfoStatsByMatchId(matchIdLong, type, topN);

                if (matchSpecifics == null || matchSpecifics.isEmpty()) {
                    // 참가자 정보 없으면 빈 리스트로 넣고 넘어감
                    allMatchSpecificsDifferenceAdded.add(Collections.emptyList());
                    continue;
                }

                // 5-1. 내 기록 찾기
                MatchSpecificsStatsDTO myData = null;
                for (MatchSpecificsStatsDTO specifics : matchSpecifics) {
                    if (userId.equals(specifics.getUserId())) {
                        myData = specifics;
                        break;
                    }
                }

                // 내 기록이 없으면 비교 기준이 없으니, 빈 리스트로 넣고 넘김
                if (myData == null) {
                    allMatchSpecificsDifferenceAdded.add(Collections.emptyList());
                    continue;
                }

                // 5-2. 내 기록(기준값) 뽑기
                Float myQueueSelectTime = myData.getQueueSelectTimeSafe();
                Integer myQueueMissCount = myData.getQueueMissCountSafe();

                Float myCaptchaSelectTime = myData.getCaptchaSelectTimeSafe();
                Integer myCaptchaBackspaceCount = myData.getCaptchaBackspaceCountSafe();
                Integer myCaptchaTrialCount = myData.getCaptchaTrialCountSafe();

                Float mySeatSelectTime = myData.getSeatSelectTimeSafe();
                Integer mySeatClickMissCount = myData.getSeatSelectClickMissCountSafe();
                Integer mySeatTrialCount = myData.getSeatSelectTrialCountSafe();

                // 5-3. 다른 사람들과의 차이 계산
                List<MatchSpecificsStatsDifferenceAddedDTO> specificsDiffAdded = new ArrayList<>();

                for (MatchSpecificsStatsDTO specifics : matchSpecifics) {
                    // 상대 raw 값
                    Float otherQueueSelectTime = specifics.getQueueSelectTimeSafe();
                    Integer otherQueueMissCount = specifics.getQueueMissCountSafe();

                    Float otherCaptchaSelectTime = specifics.getCaptchaSelectTimeSafe();
                    Integer otherCaptchaBackspaceCount = specifics.getCaptchaBackspaceCountSafe();
                    Integer otherCaptchaTrialCount = specifics.getCaptchaTrialCountSafe();

                    Float otherSeatSelectTime = specifics.getSeatSelectTimeSafe();
                    Integer otherSeatClickMissCount = specifics.getSeatSelectClickMissCountSafe();
                    Integer otherSeatTrialCount = specifics.getSeatSelectTrialCountSafe();

                    // total time (소수 둘째 자리)
                    Float totalTime = roundTwoDigits(
                            otherQueueSelectTime + otherCaptchaSelectTime + otherSeatSelectTime
                    );

                    // (상대 - 나) 기준 차이
                    Float queueTimeDifference = roundTwoDigits(otherQueueSelectTime - myQueueSelectTime);
                    Integer queueMissCountDifference = otherQueueMissCount - myQueueMissCount;

                    // 캡차 시간/백스페이스 차이
                    Float captchaTimeDifference = roundTwoDigits(otherCaptchaSelectTime - myCaptchaSelectTime);
                    Integer captchaBackSpaceCountDifference = otherCaptchaBackspaceCount - myCaptchaBackspaceCount;
                    Integer captchaTrialCountDifference = otherCaptchaTrialCount - myCaptchaTrialCount;

                    // 좌석 선택 관련 차이
                    Float seatSelectTimeDifference = roundTwoDigits(otherSeatSelectTime - mySeatSelectTime);
                    Integer seatClickMissDifference = otherSeatClickMissCount - mySeatClickMissCount;
                    Integer seatTrialCountDifference = otherSeatTrialCount - mySeatTrialCount;

                    // DTO 생성 (생성자 파라미터 순서는 DTO 정의와 맞춰야 함)
                    MatchSpecificsStatsDifferenceAddedDTO dto =
                            MatchSpecificsStatsDifferenceAddedDTO.dtobuilder(
                                    specifics,                 // @JsonUnwrapped
                                    totalTime,

                                    queueTimeDifference,
                                    queueMissCountDifference,

                                    captchaTimeDifference,
                                    captchaBackSpaceCountDifference,
                                    captchaTrialCountDifference,

                                    seatSelectTimeDifference,
                                    seatClickMissDifference,
                                    seatTrialCountDifference
                            );

                    specificsDiffAdded.add(dto);
                }
                allMatchSpecificsDifferenceAdded.add(specificsDiffAdded);
            }

            // 6. matchInfo + specificsDiffAdded 묶어서 MatchDataDTO로 변환
            for (int i = 0; i < matchData.size(); i++) {
                MatchInfoStatsDTO info = matchData.get(i);
                List<MatchSpecificsStatsDifferenceAddedDTO> specificsDiffAdded =
                        i < allMatchSpecificsDifferenceAdded.size()
                                ? allMatchSpecificsDifferenceAdded.get(i)
                                : Collections.emptyList();

                MatchDataDTO dto = MatchDataDTO.dtobuilder(info, specificsDiffAdded);
                matchResults.add(dto);
            }
        }

        return matchResults;
    }


    /**
     * 기존 메서드
     * */
    // Match 관련 전체 정보를 가져온다.
    public List<MatchInfoStatsDTO> getMatchInfoStats(Long userId, String mode , int page, int size){
        Pageable topN = PageRequest.of(page, size);

        // RoomType 반영
        Object roomType = null;

        mode = mode.trim().toLowerCase();
        // 1. RoomType Exception
        /**
         * Exception 1
         * 모드 유형 존재 안함.
         * */
        if(mode.equals("solo")){
            roomType = Room.RoomType.SOLO;
        }else if(mode.equals("multi")){
            roomType = Room.RoomType.MULTI;
        }else if(mode.equals("all")){
            roomType = "all";
        }else{
            throw new RoomTypeException(mode + "유형이 존재하지 않았습니다.");
        }

        Room.RoomType SOLO = Room.RoomType.SOLO;
        Room.RoomType MULTI = Room.RoomType.MULTI;

        List<Object> result = new ArrayList<>();

        List<MatchInfoStatsDTO> matchData = new ArrayList<>();

        // Solo, Multi 데이터 처리.
        if(roomType.equals(Room.RoomType.SOLO) || roomType.equals(Room.RoomType.MULTI)){
            Room.RoomType roomTypeCasted = (Room.RoomType) roomType;
            List<MatchInfoStatsDTO> gameTypeData = userStatsRepository.findMatchInfoStatsByUserId(userId, roomTypeCasted, topN);

            /**
             * 데이터 없음.
             * */
            if( gameTypeData.isEmpty()){
                return Collections.emptyList();
            }

            matchData = gameTypeData;

        }// 전체 데이터 처리
        else if(roomType.equals("all")){
            List<MatchInfoStatsDTO> soloData =  userStatsRepository.findMatchInfoStatsByUserId(userId, SOLO, topN);
            List<MatchInfoStatsDTO> multiData = userStatsRepository.findMatchInfoStatsByUserId(userId, MULTI, topN);

            /**
             * 데이터 없음.
             * */
            if( soloData.isEmpty() && multiData.isEmpty() ){
                return Collections.emptyList();
            }

            for(MatchInfoStatsDTO solo: soloData ){
                matchData.add(solo);
            }
            for(MatchInfoStatsDTO multi:multiData){
                matchData.add(multi);
            }
            // 시간 역순 정렬
            matchData.sort((MatchInfoStatsDTO m1, MatchInfoStatsDTO m2) -> m2.getStartedAt().compareTo(m1.getStartedAt()));

            if(matchData.size() > 5){
                matchData = matchData.subList(0,5);
            }

        }

        return matchData;
    }

    // Match 내 사람들 정보 가져오기.
    public Object getMatchUserSpecificInfo(Long matchIdLong, Long userIdLong ,String mode, int page, int size){
        Object roomType = null;

        // solo, multi, all
        if(mode.equals("solo")){
            roomType = Room.RoomType.SOLO;
        }else if(mode.equals("multi")){
            roomType = Room.RoomType.MULTI;
        }else if(mode.equals("all")){
            roomType = "all";
        }else{
            throw new RoomTypeException(mode + "유형이 존재하지 않았습니다.");
        }

        // page offset 정보, 한 페이지당 최대 수 size, 최대 N개
        Pageable topN = PageRequest.of(page, size);

        // 결과 담을 객체.
        List<Object> result = new ArrayList<>();

        // 나의 정보, 다른 사람 정보 같이 담아준다.
        List<MatchSpecificsStatsDTO> matchData = new ArrayList<>();

        if( roomType.equals("solo") || roomType.equals("multi")){
            Room.RoomType roomTypeCasted = (Room.RoomType) roomType;
            System.out.println(roomTypeCasted);

            // Match 내 사용자 정보 가져오기.
            List<MatchSpecificsStatsDTO> matchSpecificsInfos = userStatsRepository.findMatchSpecificInfoStatsByMatchId(matchIdLong, roomTypeCasted, topN);
            matchData = matchSpecificsInfos;

            if(roomType.equals("multi")){
                MatchSpecificsStatsDTO myData = null;
                for(MatchSpecificsStatsDTO matchSpecificsInfo: matchSpecificsInfos){
                    //해당 유저에 대한 정보는 따로 빼둔다.
                    if(userIdLong.equals(matchSpecificsInfo.getUserId())) {
                        myData = matchSpecificsInfo;
                    }
                }
            }


        }else{
            List<MatchSpecificsStatsDTO> matchSoloData = userStatsRepository.findMatchSpecificInfoStatsByMatchId(userIdLong, Room.RoomType.SOLO, topN);
            List<MatchSpecificsStatsDTO> matchMultiData = userStatsRepository.findMatchSpecificInfoStatsByMatchId(userIdLong, Room.RoomType.MULTI, topN);

            MatchSpecificsStatsDTO myData = null;
            for(MatchSpecificsStatsDTO solo: matchSoloData){
                matchData.add(solo);

            }

            for(MatchSpecificsStatsDTO multi: matchMultiData){
                matchData.add(multi);
                //해당 유저에 대한 정보는 따로 빼둔다.
                if(userIdLong.equals(multi.getUserId())) {
                    myData = multi;
                }
            }

        }

        result.add(matchData);


        return result;
    }

}
