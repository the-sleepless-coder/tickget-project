package com.tickget.searchserver.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 검색 응답 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchResponse {

    private Long total;          // 전체 결과 수
    private Long took;           // 검색 소요 시간 (ms)
    private List<ConcertHallDto> results;  // 검색 결과 리스트
}
