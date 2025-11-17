package com.stats.util;

import com.stats.entity.UserStats;

import java.util.List;

public class StatsCalculator {

    // 3. 헬퍼 메서드들
    /**
     * Integer 필드의 평균을 계산
     * 이거 StatsBatchService관련 메서드로 따로 빼놓는게 정신 건강에 좋을듯.
     */
    public static Float calculateAvgFloat(List<UserStats> stats, FloatExtractor extractor) {
        if(stats == null || stats.isEmpty()){
            return 0f;
        }

        float sum = 0f;
        int count = 0 ;

        for(UserStats us: stats){
            // 1. 필요한 값 추출
            Float val = extractor.extract(us);
            // 2. 평균  계산
            if(val != null){
                sum+=val;
                count++;
            }
        }

        return count == 0 ? 0f : sum/count;

    }

    /**
     * Float 필드의 평균을 Integer로 반올림하여 계산
     */
    public static Float calculateAvgInt(List<UserStats> stats, IntExtractor extractor) {
        float sum = 0f;
        int count = 0;

        for(UserStats us: stats){
            Integer val = extractor.extract(us);
            if(val!=null){
                sum+=val;
                count++;
            }

        }

        return count==0? 0f: sum/count;
    }

    /**
     * BOT 여부 판별
     * (UserStats에 isBot 필드가 있다고 가정, 없으면 다른 방법으로 판별)
     */
    public static boolean isBot(UserStats userStats) {
        Long userIdLong =userStats.getId();

        if(userIdLong<0){
            return true;
        }

        return false;
    }

    /**
     * Null 값 처리.
     * */
    public static float nvl(Float value) {
        return value != null ? value : 0f;
    }

    public static int nvl(Integer value) {
        return value != null ? value : 0;
    }
}
