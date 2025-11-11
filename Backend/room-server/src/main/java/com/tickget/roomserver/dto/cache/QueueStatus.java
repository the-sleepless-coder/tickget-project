package com.tickget.roomserver.dto.cache;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QueueStatus {
    private Long ahead;          // 앞에 있는 사람 수
    private Long behind;         // 뒤에 있는 사람 수
    private Long total;          // 전체 대기 인원
    private Long lastUpdated;    // 마지막 업데이트 시각

}