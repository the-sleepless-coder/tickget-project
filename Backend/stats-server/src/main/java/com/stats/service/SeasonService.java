package com.stats.service;

import com.stats.entity.Season;
import com.stats.repository.SeasonRepository;
import com.stats.util.StatsCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class SeasonService {
    private final SeasonRepository seasonRepository;

    // 해당되는 SeasonCode를 찾아서,
    // 없으면 새로운 SeasonCode 생성.
    public String getOrCreateSeasonCode(LocalDateTime now) {
        String seasonCode = StatsCalculator.buildRankKey(now);  // 아까 만든 거 재사용

        return seasonRepository.findByCode(seasonCode)
                .map(Season::getCode)
                .orElseGet(() -> {
                    // 없으면 새 시즌 생성
                    Season newSeason = createSeasonFor(now, seasonCode);
                    seasonRepository.save(newSeason);
                    log.info("New season created: {}", seasonCode);
                    return newSeason.getCode();
                });
    }

    // Season Code에 대한 정보 없을 시,
    // 필요 정보 설정하기.
    private Season createSeasonFor(LocalDateTime now, String seasonCode) {
        LocalDate today = now.toLocalDate();

        // 여기서 주차별 start/end 계산 로직 너 마음대로 정의하면 됨.
        // 예시: 해당 "주차"가 포함된 주의 월요일~일요일
        LocalDate start = today.with(DayOfWeek.MONDAY);
        LocalDate end   = today.with(DayOfWeek.SUNDAY);

        return Season.builder()
                .code(seasonCode)
                .name(seasonCode + " 시즌")
                .startDate(start)
                .endDate(end)
                .status("ACTIVE")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

}
