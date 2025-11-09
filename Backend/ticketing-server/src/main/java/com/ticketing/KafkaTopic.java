package com.ticketing;

// Topic에 대한 ENUM 클래스 생성
// 컴파일 타임에서의 에러 방지.
public enum KafkaTopic {

    USER_DEQUEUED("user-dequeued-publish"),
    BOT_DEQUEUED("bot-dequeued-publish"),

    USER_LOG_QUEUE("user-log"),
    CAPTCHA_LOG_QUEUE("captcha-log"),
    SEAT_LOG_QUEUE("seat-log"),

    USER_LOG_GROUP("user-log-group"),
    CAPTCHA_LOG_GROUP("captcha-log-group"),
    SEAT_LOG_GROUP("seat-log-group")
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
