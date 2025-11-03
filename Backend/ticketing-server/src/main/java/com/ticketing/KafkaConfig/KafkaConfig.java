package com.ticketing.KafkaConfig;

import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.consumer.ConsumerConfig;
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
    /**
    // application.yaml에서의 설정을 이용한,
    // Kafka Producer 생성.
    @Bean
    public ProducerFactory<String, String> producerFactory(KafkaProperties kp){
        return new DefaultKafkaProducerFactory<>(kp.buildProducerProperties());
    }

    // Kafka Producer -> Producer Record
    @Bean
    public KafkaTemplate<String, String> kafkaTemplate(ProducerFactory<String, String> pf){
       return new KafkaTemplate<>(pf);
    }

    // application.yaml에서의 설정을 이용한,
    // Kafka Consumer 생성.
    @Bean
    public ConsumerFactory<String, String> consumerFactory(KafkaProperties kp){
        return new DefaultKafkaConsumerFactory<>(kp.buildConsumerProperties());
    }
     **/

    @Bean
    public AdminClient adminClient(KafkaProperties props){
        return AdminClient.create(props.buildAdminProperties(null));
    }

    @Bean("monitorConsumerFactory")
    public ConsumerFactory<String, String> monitorConsumerFactory(KafkaProperties props){
        Map<String, Object> cfg = new HashMap<>(props.buildConsumerProperties());
        cfg.put(ConsumerConfig.GROUP_ID_CONFIG, "monitor-client");
        cfg.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);

        return new DefaultKafkaConsumerFactory<>(cfg);
    }

}
