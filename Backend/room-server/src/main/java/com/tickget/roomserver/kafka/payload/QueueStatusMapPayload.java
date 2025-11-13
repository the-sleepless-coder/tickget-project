package com.tickget.roomserver.kafka.payload;

import com.tickget.roomserver.dto.cache.QueueStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.Map;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QueueStatusMapPayload {
    // userId -> QueueStatus 매핑
    private Map<Long, QueueStatus> queueStatuses;
}