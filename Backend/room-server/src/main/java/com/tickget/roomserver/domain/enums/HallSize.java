package com.tickget.roomserver.domain.enums;

public enum HallSize {
    SMALL,
    MEDIUM,
    LARGE;




    public static HallSize get(int totalSeat) {
        if (totalSeat < 1000 )
            return HallSize.SMALL;
        else if (totalSeat < 10000 )
            return HallSize.MEDIUM;
        else
            return HallSize.LARGE;
    }
}
