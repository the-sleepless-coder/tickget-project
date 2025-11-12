package com.tickget.searchserver.controller;

import com.tickget.searchserver.dto.ConcertHallDto;
import com.tickget.searchserver.dto.SearchResponse;
import com.tickget.searchserver.service.SearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.constraints.NotBlank;

@Slf4j
@RestController
@RequestMapping("/concerts/halls")
@RequiredArgsConstructor
@Tag(name = "공연장 검색", description = "Elasticsearch 기반 공연장 검색 API")
@CrossOrigin(origins = {"https://tickget.kr", "http://localhost:5173"})
public class SearchController {

    private final SearchService searchService;

    /**
     * 공연장 이름으로 자동완성 검색
     *
     * @param q    검색 키워드 (필수)
     * @param size 결과 개수 (선택, 기본값: 20)
     * @return 검색 결과 리스트
     */
    @GetMapping
    @Operation(summary = "공연장 검색", description = "공연장 이름으로 자동완성 검색 (N-gram)")
    public ResponseEntity<SearchResponse> searchConcertHalls(
            @Parameter(description = "검색 키워드", required = true)
            @RequestParam("q") @NotBlank String q,

            @Parameter(description = "결과 개수 (기본값: 20)")
            @RequestParam(value = "size", required = false) Integer size
    ) {
        log.info("Search request: keyword='{}', size={}", q, size);

        SearchResponse response = searchService.searchConcertHalls(q, size);

        return ResponseEntity.ok(response);
    }

    /**
     * 특정 공연장 상세 조회
     *
     * @param id 공연장 ID
     * @return 공연장 상세 정보
     */
    @GetMapping("/{id}")
    @Operation(summary = "공연장 상세 조회", description = "ID로 특정 공연장 정보 조회")
    public ResponseEntity<ConcertHallDto> getConcertHallById(
            @Parameter(description = "공연장 ID", required = true)
            @PathVariable String id
    ) {
        log.info("Get concert hall by ID: id={}", id);

        ConcertHallDto hall = searchService.getConcertHallById(id);

        if (hall == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(hall);
    }

    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    @Operation(summary = "Health Check", description = "서비스 상태 확인")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }
}
