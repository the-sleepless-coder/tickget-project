package com.stats.service;

import com.stats.repository.MatchStatsRepository;
import com.stats.repository.UserStatsRepository;
import lombok.RequiredArgsConstructor;
import org.apache.logging.log4j.core.config.plugins.validation.constraints.Required;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RankingService {
    private final UserStatsRepository userStatsRepository;
    private final MatchStatsRepository matchStatsRepository;


    public Float calculateRanking(Long userIdLong ){


        return null;
    }

}
