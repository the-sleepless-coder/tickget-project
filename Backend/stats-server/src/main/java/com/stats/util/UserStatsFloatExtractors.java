package com.stats.util;

import com.stats.entity.UserStats;

public class UserStatsFloatExtractors {
    // StatsExtractor Interface에 대한 구현체
    // userStat 내 DateSelectTime 가져옴.
    // 상수로 관리한 객체를 만든다.
    public static final FloatExtractor DATE_SELECT_TIME = new FloatExtractor() {
        @Override
        public Float extract(UserStats us) {
            Float v = us.getDateSelectTime();
            return (v == null) ? 0f : v;
        }
    };

    public static final FloatExtractor SECCODE_SELECT_TIME = new FloatExtractor() {
        @Override
        public Float extract(UserStats us) {
            Float v = us.getSeccodeSelectTime();
            return (v == null) ? 0f : v;
        }
    };

    public static final FloatExtractor SEAT_SELECT_TIME = new FloatExtractor() {
        @Override
        public Float extract(UserStats us) {
            Float v = us.getSeatSelectTime();
            return (v == null) ? 0f : v;
        }
    };

}
