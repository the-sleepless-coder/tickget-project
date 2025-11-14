package com.tickget.roomserver.dto.cache;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class GlobalSessionInfo {
    private String sessionId;
    private String serverId;
    private Long version;
}