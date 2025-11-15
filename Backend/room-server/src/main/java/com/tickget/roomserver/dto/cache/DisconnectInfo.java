package com.tickget.roomserver.dto.cache;


import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DisconnectInfo {
    private String oldSessionId;
    private String oldServerId;
    private Long roomId;
    private String userName;
    private Long disconnectTime;

    public boolean isWithinGracePeriod(long gracePeriodMs) {
        return System.currentTimeMillis() - disconnectTime < gracePeriodMs;
    }

    public static DisconnectInfo of (String oldSessionId, String oldServerId, Long roomId, String userName) {
        return DisconnectInfo.builder()
                .oldSessionId(oldSessionId)
                .oldServerId(oldServerId)
                .roomId(roomId)
                .userName(userName)
                .disconnectTime(System.currentTimeMillis())
                .build();
    }


}
