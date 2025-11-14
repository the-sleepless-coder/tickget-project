package com.tickget.roomserver.kafka.payload;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForceDisconnectPayload {
    private String reason;  // 종료 이유 (예: "DUPLICATE_SESSION")
    private String message;
    private Long timestamp;
}
