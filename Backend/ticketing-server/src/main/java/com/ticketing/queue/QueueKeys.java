package com.ticketing.queue;

public class QueueKeys {
    private QueueKeys(){}

    // roomId별로 userId의 대기열, 상태, 시퀀스 관리를 위한 변수.

    // 들어온 순서 업데이트 저장을 위한 키 변수
    private static final String SEQ_KEY = "queue:seq";
    public static String waitingZSet(String roomId){
        return "queue:%s:waiting".formatted(roomId);
    }

    // 방별 사용자 상태 키 변수
    public static String userStateKey(String roomId, String userId){
        return "queue:%s:%s".formatted(roomId, userId);
    }

    // 방별 순서 계산을 위한 시퀀스 변수
    public static String sequence(String roomId){
        return "queue:%s:seq".formatted(roomId);
    }

    // 내 앞에 빠진 사람 수 누적을 위한 변수
    public static String roomOffset(String roomId){
        return "queue:%s:offset".formatted(roomId);
    }

    // 빠진 사람만큼 방 내 최대 인원 반영을 위한 변수
    public static String roomTotal(String roomId){
        return "queue:%s:total".formatted(roomId);
    }
}
