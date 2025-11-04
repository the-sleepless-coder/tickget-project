package com.ticketing.config;

import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.core.*;

import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableKafka
public class KafkaConfig {
    // Kafka Producer -> Producer Record
    @Bean
    public KafkaTemplate<String, String> kafkaTemplate(ProducerFactory<String, String> pf){
       return new KafkaTemplate<>(pf);
    }

    // Kafka Cluster의 Meta-data 관리용 Bean 생성.
    @Bean
    public AdminClient adminClient(KafkaProperties props){
        return AdminClient.create(props.buildAdminProperties(null));
    }

    // AdminClient에서 Meta-data를 처리하는 Consumer Bean 생성.
    @Bean
    @Qualifier("monitorCf")
    public ConsumerFactory<String, String> monitorConsumerFactory(KafkaProperties props){
        Map<String, Object> cfg = new HashMap<>(props.buildConsumerProperties());
        cfg.put(ConsumerConfig.GROUP_ID_CONFIG, "monitor-client");
        cfg.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);

        return new DefaultKafkaConsumerFactory<>(cfg);
    }

}
