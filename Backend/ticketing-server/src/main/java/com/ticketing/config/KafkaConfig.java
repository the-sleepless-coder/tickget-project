package com.ticketing.config;

import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.core.*;

@Configuration
@EnableKafka
public class KafkaConfig {

    // application.yaml에 있는 설정 파일 기준, producer 생성
    @Bean
    public ProducerFactory<String, String> producerFactory(KafkaProperties kp){
        return new DefaultKafkaProducerFactory<>(kp.buildProducerProperties());
    }

    //
    @Bean
    public KafkaTemplate<String, String> kafkaTemplate(ProducerFactory<String, String> pf){
       return new KafkaTemplate<>(pf);
    }

    //
    @Bean
    public ConsumerFactory<String, String> consumerFactory(KafkaProperties kp){
        return new DefaultKafkaConsumerFactory<>(kp.buildConsumerProperties());
    }
}
