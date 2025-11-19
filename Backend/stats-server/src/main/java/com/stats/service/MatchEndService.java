package com.stats.service;

import com.stats.dto.response.RankingData.RankingDTO;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MatchEndService {
    private final StatsBatchService statsBatchService;
    private final RankingService rankingService;

    @Transactional
    public void processMatchEnd(Long matchId){

        boolean updateState = statsBatchService.updateMatchStats(matchId);

        if(!updateState){
            // 통계 업데이트 실패하면 전체 롤백시키고 싶으면 예외 던져
            throw new IllegalStateException("Failed to update MATCH STATS for matchId=" + matchId);
        }

        List<RankingDTO> rankingDTOList = rankingService.calculateRanking(matchId);

        if(rankingDTOList.isEmpty()){
            // 통계 업데이트 실패하면 전체 롤백시키고 싶으면 예외 던져
            throw new IllegalStateException("Failed to update RANKINGS for matchId=" + matchId);
        }
    }

}
