package com.stats.config;

import com.stats.listener.RedisKeyEventListener;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class RedisKeyEventConfig {
    /**
    private final RedisConnectionFactory factory;

    // Redis에서 Publish 된 이벤트를 듣는 컨테이너.
    @Bean
    public RedisMessageListenerContainer redisContainer(MessageListenerAdapter listenerAdapter){
        // Redis Keyspace Notifications 활성화
        try {
            log.info("Attempting to enable Redis Keyspace Notifications...");
            RedisConnection connection = factory.getConnection();
            connection.serverCommands().setConfig("notify-keyspace-events", "Exg");
            log.info("Redis Keyspace Notifications Enabled: Exg");
        } catch (Exception e) {
            log.error("Failed to enable Redis Keyspace Notifications", e);
        }

        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);

        // 특정 키에 대한 이벤트 리스닝 (예: __keyevent@0__:set)
        container.addMessageListener(listenerAdapter, new PatternTopic("__keyevent@0__:set"));

        return container;
    }

    @Bean
    public MessageListenerAdapter listenerAdapter(RedisKeyEventListener listener) {
        MessageListenerAdapter adapter = new MessageListenerAdapter(listener, "handleMessage");
        adapter.setStringSerializer(new org.springframework.data.redis.serializer.StringRedisSerializer());
        return adapter;
    }

     */
}
