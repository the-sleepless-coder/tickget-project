package com.stats.scheduler;

import com.stats.entity.Ranking;
import com.stats.service.RankingService;
import com.stats.service.SeasonService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class RankingFlushScheduler {
    private final SeasonService seasonService;
    private final RankingService rankingService;

    /**
     * 환경 변수 처리 필요.
     * */
    // 매일 오전 9시 실행
    @Scheduled(cron = "0 0 9 * * *")
    public void flushMorning() {
        LocalDateTime now = LocalDateTime.now();
        String seasonCode = seasonService.getOrCreateSeasonCode(now);
        rankingService.flushSeasonRanking(seasonCode, now, Ranking.SnapshotRound.MORNING);
    }

    // 매일 오후 9시 실행
    @Scheduled(cron = "0 0 15 * * *")
    public void flushEvening() {
        LocalDateTime now = LocalDateTime.now();
        String seasonCode = seasonService.getOrCreateSeasonCode(now);
        rankingService.flushSeasonRanking(seasonCode, now, Ranking.SnapshotRound.EVENING);
    }
}
