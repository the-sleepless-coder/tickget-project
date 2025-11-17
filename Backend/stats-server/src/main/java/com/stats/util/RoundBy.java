package com.stats.util;

public class RoundBy {
    public static float decimal(float value, int places) {
        if (places < 0) throw new IllegalArgumentException("places must be >= 0");

        float scale = (float) Math.pow(10, places);
        return Math.round(value * scale) / scale;
    }
}
