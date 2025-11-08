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
    private Integer ahead;       // 내 앞에 있는 플레이어 수
    private Integer behind;      // 내 뒤에 있는 플레이어 수
    private Integer rawRank;     // 최초 진입 시 순위
    private Integer joinOffset;  // 누적 빠진 사람 수
}