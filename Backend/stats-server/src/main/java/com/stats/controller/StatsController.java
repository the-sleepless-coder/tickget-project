package com.stats.controller;

import com.stats.dto.response.ClickStatsDTO;
import com.stats.entity.User;
import com.stats.service.StatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.Optional;

@Controller
@RequiredArgsConstructor
@RequestMapping("/stats")
@Tag(name = "Stats", description = "Stat 관련 API")
public class StatsController {
    private final StatsService service;

    /**
     * 개인 통계
     */

    @GetMapping("/mypage")
    @Operation(
            summary = "",
            description = ""
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "데이터 조회 생성 성공"),
            @ApiResponse(responseCode = "404", description = "데이터 조회 실패")
    })
    public ResponseEntity<?> getMyPageInfo(HttpServletRequest request){
        String userIdString =  request.getHeader("X-User-Id");
        if(userIdString==null){
            ResponseEntity.badRequest().body("Wrong request");
        }
        Long userIdLong = Long.valueOf(userIdString);

        ClickStatsDTO user =(ClickStatsDTO) service.getDurationInfo(userIdLong);

        return ResponseEntity.ok(user);
    }

    // 데이터 추가 API offset 이용




    /**
     * 경기 기록
     * */
    // 타 유저 검색

    // 전체 경기 기록


}
