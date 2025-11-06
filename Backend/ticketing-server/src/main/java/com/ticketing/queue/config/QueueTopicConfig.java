package com.ticketing.queue.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

// Config 클래스 통한,
// Component Scan/Bean을 이용해 Spring이 객체를 관리하도록 만든다.
// QueueTopicProps에 대한 Bean 형성
@Configuration
@EnableConfigurationProperties(QueueTopicProps.class)
public class QueueTopicConfig {
    // QueueTopicProps에서 변수 가져와서,
    // TopicBuilder에 name, partitions, replica수 결정.
    private final QueueTopicProps props;

    public QueueTopicConfig(QueueTopicProps props){
        this.props = props;
    }

    @Bean
    public NewTopic userQueueTopic(){
        return TopicBuilder.name(props.name())
                .partitions(props.partitions())
                .replicas(props.replicas())
                .build();
    }
}
