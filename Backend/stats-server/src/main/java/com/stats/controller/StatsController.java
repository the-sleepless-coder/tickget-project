package com.stats.controller;

import com.stats.dto.response.IndividualData.MyPageDTO;
import com.stats.dto.response.IndividualData.SpecificStatsDTO;
import com.stats.dto.response.MatchData.MatchDataDTO;
import com.stats.service.StatsBatchService;
import com.stats.service.StatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@Slf4j
@Controller
@RequiredArgsConstructor
@Tag(name = "Stats", description = "Stat 관련 API")
public class StatsController {
    private final StatsService service;
    private final StatsBatchService statsBatchService;

    /**
     * 개인 통계
     */
    @GetMapping("/mypage")
    @Operation(
            summary = "마이페이지에 대한 초기 정보를 가져옵니다.",
            description = "각 단계별 소요 시간 데이터, 경기 상세 데이터"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "데이터 조회 생성 성공"),
            @ApiResponse(responseCode = "500", description = "데이터 조회 실패"),
            @ApiResponse(responseCode = "400", description = "사용자의 잘못된 요청")
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
    // 전체 경기 기록
    // 각 페이지별 데이터 가져오기
    // Default Value: page = 0, size = 5
    @GetMapping("/mypage/matchData")
    public ResponseEntity<?> getMatchInfo(HttpServletRequest request, @RequestParam("mode") String mode, @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="5") int size){
        String userIdString = request.getHeader("X-User-Id");
        if(userIdString == null){
            ResponseEntity.badRequest().body("Wrong request");
        }
        Long userIdLong = Long.valueOf(userIdString);

        List<MatchDataDTO> data = service.getMatchDataStats(userIdLong, mode, page, size);

        return ResponseEntity.ok(data);

    }

    /**
     * Batch 단위로 데이터 수집
     * */
    // 게임 끝났을 때 집계 작업 수행.
    @GetMapping("/stats/matches/{matchId}")
    public ResponseEntity<?> onGameEnd(@PathVariable("matchId")Long matchId) {

        // 1. 경기 종료 시 즉시 매치 통계 계산
        boolean updateState = statsBatchService.updateMatchStats(matchId);

        if(updateState){
            String message = "Match Updated for %s".formatted(matchId);
            log.info("Game ended and stats updated for matchId: {}", matchId);
            return ResponseEntity.ok(message);
        }else{
            String errorMsg = "No UserStats found for matchId: %d".formatted(matchId);
            log.warn(errorMsg);

            return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .body(errorMsg);
        }

    }


    // 매치 관련 데이터 가져오기
    // 해당 userId에 맞게 한 페이지에 5개씩 가져오기

}
