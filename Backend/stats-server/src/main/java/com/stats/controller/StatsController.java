package com.stats.controller;

import com.stats.dto.response.ClickStatsDTO;
import com.stats.dto.response.MyPageDTO;
import com.stats.dto.response.SpecificStatsDTO;
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
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;
import java.util.Optional;

@Controller
@RequiredArgsConstructor
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
            @ApiResponse(responseCode = "500", description = "데이터 조회 실패"),
            @ApiResponse(responseCode = "404", description = "사용자의 잘못된 요청")
    })
    public ResponseEntity<?> getMyPageInfo(HttpServletRequest request, @RequestParam(defaultValue = "0") int page){
        String userIdString =  request.getHeader("X-User-Id");
        if(userIdString==null){
            ResponseEntity.badRequest().body("Wrong request");
        }
        Long userIdLong = Long.valueOf(userIdString);

        MyPageDTO myPageData = service.getMyPageInfo(userIdLong, page);

        return ResponseEntity.ok(myPageData);

    }

    // 데이터 추가 API offset 이용
    @GetMapping("/mypage/specificsData")
    public ResponseEntity<?> getAdditionalSpecificData(HttpServletRequest request, @RequestParam(defaultValue="0") int page){
        String userIdString = request.getHeader("X-User-Id");
        if(userIdString == null){
            ResponseEntity.badRequest().body("Wrong request");
        }
        Long userIdLong = Long.valueOf(userIdString);

        List<SpecificStatsDTO> specificsData =  service.getSpecificUserStats(userIdLong, page);

        return ResponseEntity.ok(specificsData);
    }



    /**
     * 경기 기록
     * */
    // 타 유저 검색

    // 전체 경기 기록


}
