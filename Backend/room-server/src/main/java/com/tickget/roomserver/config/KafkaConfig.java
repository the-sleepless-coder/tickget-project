package com.tickget.roomserver.config;

import com.tickget.roomserver.event.HostChangedEvent;
import com.tickget.roomserver.event.RoomPlayingEndedEvent;
import com.tickget.roomserver.event.RoomPlayingStartedEvent;
import com.tickget.roomserver.event.RoomSettingUpdatedEvent;
import com.tickget.roomserver.event.SessionCloseEvent;
import com.tickget.roomserver.event.UserJoinedRoomEvent;
import com.tickget.roomserver.event.UserLeftRoomEvent;
import java.util.HashMap;
import java.util.Map;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.serializer.JsonSerializer;

@Configuration
@EnableKafka
public class KafkaConfig {
    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;

    // 입장 이벤트 Producer
    @Bean
    public KafkaTemplate<String, UserJoinedRoomEvent> joinedEventKafkaTemplate() {
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(producerConfigs()));
    }

    // 퇴장 이벤트 Producer
    @Bean
    public KafkaTemplate<String, UserLeftRoomEvent> leftEventKafkaTemplate() {
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(producerConfigs()));
    }

    @Bean
    public KafkaTemplate<String, SessionCloseEvent> sessionCloseEventKafkaTemplate(){
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(producerConfigs()));
    }

    @Bean
    public KafkaTemplate<String, HostChangedEvent> hostChangedEventKafkaTemplate() {
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(producerConfigs()));
    }

    @Bean
    public KafkaTemplate<String, RoomSettingUpdatedEvent> roomSettingUpdatedEventKafkaTemplate() {
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(producerConfigs()));
    }

    @Bean
    public KafkaTemplate<String, RoomPlayingEndedEvent> roomPlayingEndedEventKafkaTemplate() {
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(producerConfigs()));
    }

    @Bean
    public KafkaTemplate<String, RoomPlayingStartedEvent> roomPlayingStartedEventKafkaTemplate() {
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(producerConfigs()));
    }

    private Map
            <String, Object> producerConfigs() {
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        props.put(JsonSerializer.ADD_TYPE_INFO_HEADERS, true);
        return props;
    }
}
