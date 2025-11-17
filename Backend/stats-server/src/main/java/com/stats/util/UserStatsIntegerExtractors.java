package com.stats.util;

import com.stats.entity.UserStats;

public class UserStatsIntegerExtractors {
    public static final IntExtractor DATE_MISS_COUNT = new IntExtractor() {
        @Override
        public Integer extract(UserStats us) {
            Integer v = us.getDateMissCount();
            return (v == null) ? 0 : v;
        }
    };

    public static final IntExtractor SECCODE_BACKSPACE_COUNT = new IntExtractor() {
        @Override
        public Integer extract(UserStats us) {
            Integer v = us.getSeccodeBackspaceCount();
            return (v == null) ? 0 : v;
        }
    };

    public static final IntExtractor SECCODE_TRIAL_COUNT = new IntExtractor() {
        @Override
        public Integer extract(UserStats us) {
            Integer v = us.getSeccodeTryCount();
            return (v == null) ? 0 : v;
        }
    };

    public static final IntExtractor SEAT_SELECT_TRY_COUNT = new IntExtractor() {
        @Override
        public Integer extract(UserStats us) {
            Integer v = us.getSeatSelectTryCount();
            return (v == null) ? 0 : v;
        }
    };

    public static final IntExtractor SEAT_SELECT_CLICK_MISS_COUNT = new IntExtractor() {
        @Override
        public Integer extract(UserStats us) {
            Integer v = us.getSeatSelectClickMissCount();
            return (v == null) ? 0 : v;
        }
    };

}
