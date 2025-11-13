package com.tickget.searchserver.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Elasticsearch concert-halls 인덱스의 도큐먼트 매핑 클래스
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true) // 알 수 없는 필드 무시
public class ConcertHall {

    @JsonProperty("_id")
    private String id;

    private String name;

    @JsonProperty("total_seat")
    private Integer totalSeat;

    // created_at 필드는 검색 API에서 사용하지 않으므로 제거
}
