package com.ticketing.queue.config;

import lombok.RequiredArgsConstructor;
import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.DescribeTopicsResult;
import org.apache.kafka.clients.admin.NewPartitions;
import org.apache.kafka.clients.admin.TopicDescription;
import org.apache.logging.log4j.core.tools.picocli.CommandLine;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaAdmin;

import java.util.List;
import java.util.Map;
@Configuration
@RequiredArgsConstructor
public class QueueTopicReconciler implements ApplicationRunner {
    private final KafkaAdmin kafkaAdmin;
    private final QueueTopicProps props; // name, partitions, replicas

    @Override
    public void run(ApplicationArguments args) throws Exception {
        Map<String, Object> cfg = kafkaAdmin.getConfigurationProperties();
        try (Admin admin = Admin.create(cfg)) {
            DescribeTopicsResult desc = admin.describeTopics(List.of(props.name()));
            TopicDescription td;
            try {
                td = desc.topicNameValues().get(props.name()).get();
            } catch (CommandLine.ExecutionException e) {
                // 토픽이 없으면 NewTopic @Bean이 생성해줄 것이므로 여기선 패스해도 됨
                return;
            }
            int current = td.partitions().size();
            int desired = props.partitions();
            if (desired > current) {
                admin.createPartitions(Map.of(props.name(), NewPartitions.increaseTo(desired)))
                        .all().get();
            }
        }
    }


}
