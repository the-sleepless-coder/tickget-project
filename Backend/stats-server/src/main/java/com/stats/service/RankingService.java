package com.stats.service;

import com.stats.dto.MyPageRankingDTO;
import com.stats.dto.RankingPercentileDTO;
import com.stats.dto.response.RankingData.RankingDTO;
import com.stats.dto.response.RankingData.RankingPreviewDTO;
import com.stats.dto.response.RankingData.RankingWeeklyDTO;
import com.stats.entity.Match;
import com.stats.entity.Ranking;
import com.stats.entity.Season;
import com.stats.entity.User;
import com.stats.repository.*;
import com.stats.util.RoundBy;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cglib.core.Local;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import com.stats.util.*;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class RankingService {
    private final RankingRepository rankingRepository;
    private final UserStatsRepository userStatsRepository;
    private final MatchStatsRepository matchStatsRepository;
    private final UserRepository userRepository;
    private final SeasonRepository seasonRepository;
    private final StringRedisTemplate redisTemplate;
    private final SeasonService seasonService;

    private static final int BOT_BASE_SCORE = 1000;
    private static final int USER_BASE_SCORE = 500;
    private static final double BASE_LOG = 10000.0;
    private static final float PEOPLE_FACTOR_MAX = 0.3f;

    private static final int DIVIDE_BY = 10;

    // Match 내 플레이어에 대한 랭킹 집계
    public List<RankingDTO> calculateRanking(Long matchIdLong){
        List<RankingDTO> givenMatchData = rankingRepository.findRankingByMatchId(matchIdLong);

        // Data 자체가 집계 안됨.
        if(givenMatchData.isEmpty()){
           log.info("no data");
            return null;
        }

        // Match별 평균, 표준편차 데이터 찾기
        Float avgQueueTime = -100f;
        Float avgCaptchaTime = -100f;
        Float avgSeatTime = -100f;
        Float stddevQueueTime = -100f;
        Float stddevCaptchaTime = -100f;
        Float stddevSeatTime = -100f;

        for(RankingDTO singleData: givenMatchData){
            avgQueueTime = singleData.getAvgDateSelectTime();
            avgCaptchaTime = singleData.getAvgSeccodeSelectTime();
            avgSeatTime = singleData.getAvgSeatSelectTime();

            stddevQueueTime = singleData.getStddevDateSelectTime();
            stddevCaptchaTime = singleData.getStddevSeccodeSelectTime();
            stddevSeatTime = singleData.getStddevSeatSelectTime();

            boolean missing = false;
            if (avgQueueTime == null) {
                log.warn("Missing avgQueueTime for matchId={}", singleData.getAvgDateSelectTime());
                missing = true;
            }
            if (avgCaptchaTime == null) {
                log.warn("Missing avgCaptchaTime for matchId={}", singleData.getAvgSeccodeSelectTime());
                missing = true;
            }
            if (avgSeatTime == null) {
                log.warn("Missing avgSeatTime for matchId={}", singleData.getAvgSeatSelectTime());
                missing = true;
            }

            if (stddevQueueTime == null) {
                log.warn("Missing stddevQueueTime for matchId={}", singleData.getStddevDateSelectTime());
                missing = true;
            }
            if (stddevCaptchaTime == null) {
                log.warn("Missing stddevCaptchaTime for matchId={}", singleData.getStddevSeccodeSelectTime());
                missing = true;
            }
            if (stddevSeatTime == null) {
                log.warn("Missing stddevSeatTime for matchId={}", singleData.getStddevSeatSelectTime());
                missing = true;
            }

            // 모든 값 존재하면 break
            if (!missing) {
                log.info("All aggregating values of the match exist");
                break;
            }else{
                log.info("Certain field missing in match_stats");
                return null;
            }

        }

        // Match내 개별 사용자에 대한 Ranking 상정
        // BASE SCORE + SPEED BONUS로 MMR산정(MatchMakingRating)
        for(RankingDTO singleUser : givenMatchData) {
            log.info("single user info {}", singleUser.toString());
            int point = 0;
            int usedBots = singleUser.getUsedBotCount();

            int basePlayerCount = 0;
            int baseTotCount = 0;

            boolean botIncluded = true;
            // 사용자 끼리 경기 시 등수
            if (usedBots == 0) {
                basePlayerCount = singleUser.getUserRank();
                baseTotCount = singleUser.getUserCount();
                botIncluded = false;
            }
            // 봇 포함 경기 시 등수
            else {
                basePlayerCount = singleUser.getTotalRank();
                baseTotCount = singleUser.getUsedBotCount() + basePlayerCount;
            }
            // Base 점수
            // (BASE_SCORE * SKILLFACTOR) * PEOPLEFACTOR * DIFFICULTYFACTOR + SPEED BONUS
            // PEOPLEFACTOR는 최대 1.3배까지만 반영
            // DIFFICULTYFACTOR는 최대 1.3배까지만 반영

            // SPEED BONUS
            // SPEED BONUS는 경기를 마친 사람에게만 부여.
            // 최대 300점까지 부여.

            /**
             * 1. baseScore
             * */
            double finalScore = 0;
            float baseScore = 0f;
            float ratio = (float) basePlayerCount / baseTotCount; // 반드시 둘 중 하나는 float로 바꿔주야, Casting 시 문제가 발생 안함.
            float skillFactor = RoundBy.decimal((1f - ratio), 2);

            // PEOPLE_FACTOR
            float peopleFactor = 1f;
            if (botIncluded) {
                float normLog = (float) (Math.log10(baseTotCount) / Math.log10(BASE_LOG));
                normLog = Math.max(0f, Math.min(1f, normLog));
                peopleFactor = 1f + PEOPLE_FACTOR_MAX * normLog * skillFactor;
            }

            // DIFFICULTY_FACTOR
            Match.Difficulty difficulty = singleUser.getDifficulty();
            float difficultyFactor = 1f;
            if(botIncluded){
                switch (difficulty) {
                    case EASY -> difficultyFactor = 1.1f;
                    case MEDIUM -> difficultyFactor = 1.2f;
                    case HARD -> difficultyFactor = 1.3f;
                }
            }

            // 1) 이론상 최대 baseScore
            final float MAX_BASE_SCORE =
                    BOT_BASE_SCORE * (1f + PEOPLE_FACTOR_MAX) * 1.3f;   // 난이도 HARD 기준 최대

            // 2) rawBaseScore 계산
            float rawBaseScore = (BOT_BASE_SCORE * skillFactor) * peopleFactor * difficultyFactor;

            // 3) Max cap 적용
            baseScore = Math.min(rawBaseScore, MAX_BASE_SCORE);

            /**
             * 2. Speed Bonus
             * */
            // 경기 끝난 사람에게만 점수 부여,
            // 표준점수로 보너스 계산
            float speedBonus = -1f;
            boolean finishedFlag = singleUser.getIsSuccess();
            if (!finishedFlag) {
                speedBonus = 0f;
            } else {
                float userQueueClickTime = singleUser.getUserDateSelectTime();
                float userSeccodeClickTime = singleUser.getUserSeccodeSelectTime();
                float userSeatClickTime = singleUser.getUserSeatSelectTime();

                float zQueue = StatsCalculator.safeZCalculate(avgQueueTime, stddevQueueTime, userQueueClickTime);
                float zCaptcha = StatsCalculator.safeZCalculate(avgCaptchaTime, stddevCaptchaTime, userSeccodeClickTime);
                float zSeat = StatsCalculator.safeZCalculate(avgSeatTime, stddevSeatTime, userSeatClickTime);

                // 2. 구간별 중요도 가중치
                final float W_QUEUE = 0.4f;
                final float W_CAPTCHA = 0.2f;
                final float W_SEAT = 0.4f;

                // 3. 속도 지수(speedIndex)
                float speedIndex =
                        W_QUEUE * zQueue +
                        W_CAPTCHA * zCaptcha +
                        W_SEAT * zSeat;

                // 4. speed bonus 계산 (z-score × 비율)
                final float SPEED_UNIT = 100f;   // z 1당 100점

                final float MAX_SPEED_BONUS = 300f;  // 상한 300
                final float MIN_SPEED_BONUS = 0;     // 하한 -0

                speedBonus = SPEED_UNIT * speedIndex;

                speedBonus = Math.max(MIN_SPEED_BONUS, Math.min(MAX_SPEED_BONUS, speedBonus));

            }

            /**
             * MMR 감소 로직
             * Fail일 때 감소, 하위 N% 감소
             **/

            /**
             * 시간 있으면 좌석선점 보너스까지 제공.
             **/
            finalScore = (int) (baseScore + speedBonus);

            log.info("userId: {} finalScore: {}", singleUser.getUserId(), finalScore);

            // Redis에 보내서 해당 시즌의 Key에 정렬 시킨다.
            Long userId = singleUser.getUserId();
            LocalDateTime now = LocalDateTime.now();

            finalScore = finalScore/DIVIDE_BY;
            // 정수부만 전달 (double 타입 유지하되 정수 값만)
            updateUserScore(userId, now, Math.floor(finalScore));

            // 일정 주기로 DB에 업데이트 시켜준다.


            // 업데이트 안된 것들 FULLTEXT SEARCH를 안 조지기 위해서, INDEX를 만들어준다.


        }

        return givenMatchData;
    }


    /**
     * match가 끝나고, 한 유저의 최종 점수를 계산한 뒤 호출
     * redisKey : 2025-11-3W
     * userIdString
     * score:deltaScore
     */
    public void updateUserScore(Long userId, LocalDateTime now , double deltaScore) {
        String redisKey = StatsCalculator.buildRankKeyByLocalDateTime(now); // ex) rank:2025-11-3W
        // Key Type, Member Type
        ZSetOperations<String, String> zset = redisTemplate.opsForZSet();

        // 누적 점수 증가 (한 경기 플레이할 때마다)
        // userIdString, 누적되는 값.
        zset.incrementScore(redisKey, userId.toString(), deltaScore);
        log.info("redisKey: {}, userId:{}, deltaScore: {}", redisKey, userId.toString(), deltaScore);
    }

    /**
     * Redis내 상위 N명의 사람을 보여준다.
     * */
    public RankingWeeklyDTO getTopN(int topNInt) {
        // 주어진 시간으로 Redis 키를 만들어준다.
        LocalDateTime now = LocalDateTime.now();
        String redisKey = StatsCalculator.buildRankKeyByLocalDateTime(now);

        // n은 최대 100으로 제한
        int limit = Math.min(topNInt, 100);
        ZSetOperations<String, String> zset = redisTemplate.opsForZSet();

        // 예: n=50 → 0~49
        Set<ZSetOperations.TypedTuple<String>> topNList =
                zset.reverseRangeWithScores(redisKey, 0, limit - 1);

        List<RankingPreviewDTO> rankingData = new ArrayList<>();

        if (topNList == null || topNList.isEmpty()) {
            return new RankingWeeklyDTO();
        }

        int rank = 1;
        for (ZSetOperations.TypedTuple<String> tuple : topNList) {
            Long userId = Long.valueOf(tuple.getValue());
            int score = (tuple.getScore()).intValue();

            User u = userRepository.findById(userId).orElseThrow(() -> new IllegalStateException("User not found: " + userId));
            String nickName = u.getNickname();
            String imageUrl = u.getProfileImageUrl();

            rankingData.add(new RankingPreviewDTO(rank++, userId, nickName,imageUrl, score));
        }

        String[] parsedKey = redisKey.split("-");
        String year = String.format("%s년",parsedKey[0]);
        String monthString = String.format("%s월",parsedKey[1]);
        String week = parsedKey[2].replace("W","");
        int weekInt = Integer.valueOf(week);
        String weekString ="";
        switch(weekInt){
            case 1:
                weekString = "첫째 주";
                break;
            case 2:
                weekString = "둘째 주";
                break;
            case 3:
                weekString = "셋째 주";
                break;
            case 4:
                weekString = "넷째 주";
                break;
            case 5:
                weekString = "다섯째 주";
                break;
        }

        LocalDateTime localNow = LocalDateTime.now();
        String localNowString = StatsCalculator.formatKoreanDateTime(localNow);

        String weeklyInfo = String.format("%s %s", monthString, weekString);
        RankingWeeklyDTO result = new RankingWeeklyDTO(weeklyInfo, rankingData, localNowString);

        return result;
    }

    // Redis에 있는 값을 DB에 집계
    // Automatic, Manual 모두 구현.
    @Transactional
    public boolean flushSeasonRanking(String seasonCode, LocalDateTime snapshotAt, Ranking.SnapshotRound round) {
        // ZSet 내 점수가 높은 순서대로,
        // Tuple 형태의 userId, MMR을 가져온다.
        // String redisKey = StatsCalculator.buildRankKeyBySeasonCode(seasonCode);
        try{
            LocalDateTime now = LocalDateTime.now();
            LocalDate dateNow = now.toLocalDate();
            String redisKey = StatsCalculator.buildRankKeyByLocalDateTime(now);

            ZSetOperations<String, String> zset = redisTemplate.opsForZSet();
            Set<ZSetOperations.TypedTuple<String>> all = zset.reverseRangeWithScores(redisKey, 0, -1);

            if( all == null || all.isEmpty()){
                log.info("There is no ranking data to flush in redis");
                return false;
            }

            // SeasonId 코드를 가져온다.
            Season season = seasonRepository.findByCode(seasonCode)
                    .orElseThrow(() -> new EntityNotFoundException("Season not found: " + seasonCode));


            Long seasonId = season.getId();
            round = StatsCalculator.calRound(snapshotAt);
            int nextSeq = rankingRepository
                                  .findMaxSnapshotSeq(seasonId, dateNow)
                                  .orElse(0) + 1;

            // Tuple내 userId, SeasonId에 대한 정보를,
            // 차례대로 DB에 저장한다.
            int rank = 1;
            int totPlayers = all.size();
            for (ZSetOperations.TypedTuple<String> tuple : all) {
                Long userId = Long.valueOf(tuple.getValue());
                int points = tuple.getScore().intValue();

                Ranking r = Ranking.builder()
                        .seasonId(seasonId)
                        .userId(userId)
                        .points(points)
                        .userRank(rank++)
                        .snapshotAt(snapshotAt)
                        .snapshotRound(round)  // MORNING / EVENING
                        .snapshotNo(nextSeq)
                        .totPlayer(totPlayers)
                        .build();

                rankingRepository.save(r);
            }

            return true;
        }catch(Exception e){
            log.error("Failed to Flush Rankings", e);
            return false;
        }

    }


    // 해당 시즌에서, 주어진 userId의 가장 최근 N개의 Match 데이터를 가져온다.
    public MyPageRankingDTO getRecentMatchDatas(Long userIdLong, int page, int size){
        Pageable pageable = PageRequest.of(page, size);
        LocalDateTime now = LocalDateTime.now();
        String seasonCode = StatsCalculator.buildRankKeyByLocalDateTime(now);
        Long seasonIdLong = seasonRepository.findByCode(seasonCode)
                .orElseThrow(() -> new IllegalStateException("No Season Code found for Season Id: " + seasonCode))
                .getId();

        Page<Ranking> pageResult = rankingRepository.findByUserIdAndSeasonIdOrderBySnapshotAtDesc(userIdLong, seasonIdLong, pageable);
        List<Ranking> totalSeason =  rankingRepository.findByUserIdAndSeasonIdOrderBySnapshotAtDesc(userIdLong, seasonIdLong);
        List<Ranking> list = pageResult.getContent();

        // 평균 상위 % 데이터 집계
        int singleUserPercentile = 0;
        int totUserPercentile = 0;
        for(Ranking singleData: totalSeason){
            singleUserPercentile += singleData.getUserRank();
            totUserPercentile += singleData.getTotPlayer();
        }

        Float avgPercentile = RoundBy.decimal( (float) singleUserPercentile/totUserPercentile *100 ,2);

        // userId
        // userNickName
        // 시즌 정보
        // snapShotAt 특정 날짜 포멧
        // userRank / totalPlayer -> 상위 % (둘째 짜리)
        User u = userRepository.findById(userIdLong).orElseThrow(()->new IllegalStateException("There is no nickname for given userId" + userIdLong));
        String nickName = u.getNickname();
        String seasonParsed = StatsParser.dateParser(seasonCode, "-");

        List<RankingPercentileDTO> percentileData = new ArrayList<>();
        for(Ranking single:list){
            String dateInfo  = StatsParser.formatKoreanDateTime(single.getSnapshotAt());
            Float percentile =  RoundBy.decimal((single.getUserRank() * 100f) / single.getTotPlayer(), 2);
            int points = (Integer)(single.getPoints());

            RankingPercentileDTO singleData =  RankingPercentileDTO.dtobuilder(dateInfo, percentile,points);

            percentileData.add(singleData);
        }

        MyPageRankingDTO totalResult = MyPageRankingDTO.dtobuilder(userIdLong, nickName, seasonParsed, avgPercentile, percentileData);

        if(list.isEmpty()){
            return null;
        }

        return totalResult;
    }


    /**
     * 집계 안된 Match 데이터를 찾아서 다시 재집계하는 로직 구현.
     * */
    // BTree에서 빨리 찾을 수 있게 CREATE_INDEX


}
