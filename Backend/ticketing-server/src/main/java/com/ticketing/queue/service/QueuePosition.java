package com.ticketing.queue.service;

import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.TopicPartitionInfo;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Service
public class QueuePosition {
    /*private final AdminClient admin;
    private final Consumer<String, String> monitorConsumer;

    // KafkaConfig에서 만든 메타 데이터 관리하는 admin,
    // 그리고 그것을 처리하는 monitorCf를 주입 받아서 monitorConsumer를 생성한다.
    public QueuePosition(AdminClient admin, @Qualifier("monitorCf")ConsumerFactory<String, String> monitorCf) {
        this.admin = admin;
        this.monitorConsumer = monitorCf.createConsumer("monitor-client", "consumer-monitor-client");
    }

    // topicId, groupId를 이용해서 남은 메시지 수를 계산한다.
    public long getTotalLag(String topic, String groupId) throws ExecutionException, InterruptedException {
        try{
            // 전체 Topic 명 호출
            var desc = admin.describeTopics(List.of(topic)).allTopicNames().get();

            // 특정 Topic에 대한 partition 검색.
            List<TopicPartitionInfo> partitionInfo = desc.get(topic).partitions();
            List<TopicPartition> partitions = new ArrayList<>();
            for(TopicPartitionInfo tp: partitionInfo){
                partitions.add(new TopicPartition(topic, tp.partition()));
            }

            if(partitions.isEmpty()) return 0L;

            // Partition별 마지막 offset 번호
            Map<TopicPartition, Long> endOffsets = monitorConsumer.endOffsets(partitions);

            // Consumer 별 committed offset 번호
            Map<TopicPartition, OffsetAndMetadata> groupOffsets =
                    admin.listConsumerGroupOffsets(groupId).partitionsToOffsetAndMetadata().get();

            // 각 Partition별 end offset - committed offset의 합산 = total Lag
            long totalLag = 0L;
            for(TopicPartition tp: partitions){
                long end = endOffsets.getOrDefault(tp, 0L);
                long committed = 0L;
                OffsetAndMetadata meta = groupOffsets.get(tp);
                if (meta != null) committed = meta.offset();
                long lag = Math.max(end - committed, 0L);
                totalLag += lag;
            }

            return totalLag;

        }catch(InterruptedException e){
            Thread.currentThread().interrupt();
            throw new RuntimeException("Lag 계산 중 인터럽트", e);
        }catch(ExecutionException e){
            throw new RuntimeException("Lag 계산 실패: " + e.getMessage(), e);
        }

    }
    */



}
