package com.ticketing.queue.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;

// application.yaml 파일 변수 가져오기
// record를 이용한 immutable 객체
@ConfigurationProperties(prefix = "app.kafka.topics.queue")
public record QueueTopicProps(String name, int partitions, short replicas){} // name, partition, replica 수



