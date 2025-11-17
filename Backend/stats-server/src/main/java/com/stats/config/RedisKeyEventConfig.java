package com.stats.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class RedisKeyEventConfig {
    private final RedisConnectionFactory factory;

    // 처음 서버 시작 이후 Redis Key 변화 publish
    @PostConstruct
    public void enableKeySpaceEvents(){
        RedisConnection connection = factory.getConnection();
        connection.serverCommands().setConfig("notify-keyspace-events", "Exg");
        log.info("Redis Keyspace Notifications Enabled: Exg");
    }


    @Bean
    public RedisMessageListenerContainer redisContainer(){

        return null;
    }


}
