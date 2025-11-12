package com.tickget.searchserver.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Elasticsearch concert-halls 인덱스의 도큐먼트 매핑 클래스
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConcertHall {

    @JsonProperty("_id")
    private String id;

    private String name;

    @JsonProperty("total_seat")
    private Integer totalSeat;

    @JsonProperty("created_at")
    private LocalDateTime createdAt;
}
