package com.ticketing.config;

import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.JsonSerializer;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaConfig {

    @Value("${spring.kafka.bootstrap-servers:localhost:9092}")
    private String bootstrapServers;

    @Bean
    public KafkaAdmin kafkaAdmin() {
        Map<String, Object> configs = new HashMap<>();
        configs.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        return new KafkaAdmin(configs);
    }

    @Bean
    public ProducerFactory<String, Object> producerFactory() {
        Map<String, Object> configProps = new HashMap<>();
        configProps.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        configProps.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        configProps.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        return new DefaultKafkaProducerFactory<>(configProps);
    }

    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate() {
        return new KafkaTemplate<>(producerFactory());
    }

    // 좌석 선택 토픽
    @Bean
    public NewTopic seatSelectedTopic() {
        return TopicBuilder.name("match.seat.selected")
                .partitions(3)
                .replicas(1)
                .build();
    }

    // 좌석 확정 토픽
    @Bean
    public NewTopic seatConfirmedTopic() {
        return TopicBuilder.name("match.seat.confirmed")
                .partitions(3)
                .replicas(1)
                .build();
    }

    // 봇 취소 토픽 (경기 시작 실패 시 이미 준비된 봇 teardown)
    @Bean
    public NewTopic botCancelledTopic() {
        return TopicBuilder.name(com.ticketing.KafkaTopic.MATCH_BOT_CANCELLED.getTopicName())
                .partitions(3)
                .replicas(1)
                .build();
    }

    // room 취소 토픽 (경기 취소 시 room 통지 — best-effort HTTP 대체)
    @Bean
    public NewTopic roomCancelledTopic() {
        return TopicBuilder.name(com.ticketing.KafkaTopic.MATCH_ROOM_CANCELLED.getTopicName())
                .partitions(3)
                .replicas(1)
                .build();
    }
}