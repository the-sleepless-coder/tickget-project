package com.tickget.searchserver.service;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch.core.GetResponse;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import com.tickget.searchserver.domain.ConcertHall;
import com.tickget.searchserver.dto.ConcertHallDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private final ElasticsearchClient elasticsearchClient;
    private static final String INDEX_NAME = "concert-halls";

    /**
     * 공연장 이름으로 자동완성 검색
     *
     * @param keyword 검색 키워드
     * @param size    결과 개수 (default: 20)
     * @return 검색 결과
     */
    public com.tickget.searchserver.dto.SearchResponse searchConcertHalls(String keyword, Integer size) {
        if (size == null || size <= 0) {
            size = 20;
        }

        try {
            // name.ngram 필드로 자동완성 검색 쿼리
            Query matchQuery = Query.of(q -> q
                    .match(m -> m
                            .field("name.ngram")
                            .query(keyword)
                    )
            );

            SearchResponse<ConcertHall> response = elasticsearchClient.search(s -> s
                            .index(INDEX_NAME)
                            .query(matchQuery)
                            .size(size)
                            .source(src -> src.filter(f -> f
                                    .includes("name", "total_seat")
                            )),
                    ConcertHall.class
            );

            // 검색 결과를 DTO로 변환
            List<ConcertHallDto> results = response.hits().hits().stream()
                    .map(this::convertToDto)
                    .collect(Collectors.toList());

            log.info("Search completed: keyword='{}', total={}, took={}ms",
                    keyword, response.hits().total().value(), response.took());

            return com.tickget.searchserver.dto.SearchResponse.builder()
                    .total(response.hits().total().value())
                    .took(response.took())
                    .results(results)
                    .build();

        } catch (IOException e) {
            log.error("Elasticsearch search failed: keyword={}", keyword, e);
            throw new RuntimeException("공연장 검색에 실패했습니다.", e);
        }
    }

    /**
     * ID로 특정 공연장 조회
     *
     * @param id 공연장 ID
     * @return 공연장 정보
     */
    public ConcertHallDto getConcertHallById(String id) {
        try {
            GetResponse<ConcertHall> response = elasticsearchClient.get(g -> g
                            .index(INDEX_NAME)
                            .id(id),
                    ConcertHall.class
            );

            if (!response.found()) {
                log.warn("Concert hall not found: id={}", id);
                return null;
            }

            ConcertHall hall = response.source();
            log.info("Concert hall found: id={}, name={}", id, hall.getName());

            return ConcertHallDto.builder()
                    .id(id)
                    .name(hall.getName())
                    .totalSeat(hall.getTotalSeat())
                    .build();

        } catch (IOException e) {
            log.error("Failed to get concert hall: id={}", id, e);
            throw new RuntimeException("공연장 조회에 실패했습니다.", e);
        }
    }

    /**
     * Hit를 ConcertHallDto로 변환
     */
    private ConcertHallDto convertToDto(Hit<ConcertHall> hit) {
        ConcertHall hall = hit.source();
        return ConcertHallDto.builder()
                .id(hit.id())
                .name(hall.getName())
                .totalSeat(hall.getTotalSeat())
                .score(hit.score())
                .build();
    }
}
