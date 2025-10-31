package com.tickget.roomserver.dto.cache;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class MemberCache {
    private Long userId;
    private String username;
    private long enteredAt;
}
