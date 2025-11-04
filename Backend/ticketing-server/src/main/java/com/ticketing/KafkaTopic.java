package com.ticketing;

// Topic에 대한 ENUM 클래스 생성
// 컴파일 타임에서의 에러 방지.
public enum KafkaTopic {
    USER_QUEUE("user-queue"),
    CAPTCHA_QUEUE("captcha-queue"),
    SEAT_QUEUE("seat"),

    USER_LOG_QUEUE("user-log-queue"),
    CAPTCHA_LOG_QUEUE("captcha-log-queue"),
    SEAT_LOG_QUEUE("seat-log-queue"),

    USER_QUEUE_GROUP("user-queue-group"),
    CAPTCHA_QUEUE_GROUP("captcha-queue-group"),
    SEAT_QUEUE_GROUP("seat-queue-group")
    ;

    // 설정한 topicName을 ENUM에 박아주고,
    // 필요할 때 get으로 조회할 수 있게 한다.
    private final String topicName;

    KafkaTopic(String topicName) {
        this.topicName = topicName;
    }

    public String getTopicName(){
        return topicName;
    }

}
