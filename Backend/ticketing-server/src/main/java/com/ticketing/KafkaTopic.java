package com.ticketing;

// Topic에 대한 ENUM 클래스 생성
// 컴파일 타임에서의 에러 방지.
public enum KafkaTopic {
    USER_QUEUE("user-queue"),
    CAPTCHA_QUEUE("captcha-queue"),
    LOG_QUEUE("log-queue")
    ;

    private final String topicName;

    KafkaTopic(String topicName) {
        this.topicName = topicName;
    }

    public String getTopicName(){
        return topicName;
    }

}
