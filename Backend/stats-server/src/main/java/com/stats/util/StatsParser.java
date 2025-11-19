package com.stats.util;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class StatsParser {

    public static String dateParser(String seasonCode, String splitKey){
        // 주어진 SeasonCode, splitKey로
        // 필요한 Month, Week 정보를 가져온다.
        String[] parsedKey = seasonCode.split(splitKey);
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

        return weeklyInfo;
    }


    public static String formatKoreanDateTime(LocalDateTime dt ) {
        // 1. 원하는 포맷으로 출력
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm");

        return dt.format(formatter);
    }
}
