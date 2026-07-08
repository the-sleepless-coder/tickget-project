package com.ticketing.queue.scheduler;

import com.ticketing.entity.Match;
import com.ticketing.entity.Outbox;
import com.ticketing.queue.outbox.OutboxEventType;
import com.ticketing.queue.outbox.OutboxPublisher;
import com.ticketing.queue.outbox.RoomCancelOutboxWriter;
import com.ticketing.repository.MatchRepository;
import com.ticketing.repository.OutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class OutboxRecoveryScheduler {
    private final OutboxRepository outboxRepository;
    private final OutboxPublisher outboxPublisher;
    private final MatchRepository matchRepository;
    private final RoomCancelOutboxWriter roomCancelOutboxWriter;

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void recover() {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(1);

        // PENDING이면서 1분 이상 지난 것 + 3회 미만 → 재시도
        List<Outbox> pending = outboxRepository
                .findByStatusAndRetryCountLessThanAndCreatedTimeBefore(
                        Outbox.OutboxStatus.PENDING, 3, threshold
                );

        for (Outbox outbox : pending) {
            outbox.setRetryCount(outbox.getRetryCount() + 1);
            outboxPublisher.publish(outbox);
        }

        // 3회 초과 → FAILED
        List<Outbox> failed = outboxRepository
                .findByStatusAndRetryCountGreaterThanEqual(Outbox.OutboxStatus.PENDING, 3);

        for (Outbox outbox : failed) {
            outbox.setStatus(Outbox.OutboxStatus.FAILED);
            outboxRepository.save(outbox);

            // 봇 준비 요청이 최종 실패한 경우에만 경기 취소 + room 통지.
            // (ROOM 취소/봇 teardown outbox 의 실패는 재취소 대상이 아니므로 로그만 — 여기서
            //  aggregateId 를 matchId 로 오인해 엉뚱한 매치를 취소하는 것을 방지)
            if (outbox.getAggregateType() == Outbox.AggregateType.BOT
                    && OutboxEventType.BOT_PREPARE_REQUESTED.equals(outbox.getEventType())) {
                log.error("봇 요청 최종 실패 → 경기 취소: matchId={}", outbox.getAggregateId());
                matchRepository.findById(outbox.getAggregateId()).ifPresent(match -> {
                    match.setStatus(Match.MatchStatus.CANCELLED);
                    matchRepository.save(match);
                    // room 취소 통지 — best-effort HTTP 대신 outbox 로 발행 보장
                    roomCancelOutboxWriter.enqueue(match.getMatchId(), match.getRoomId());
                });
            } else {
                log.error("Outbox 최종 실패(FAILED): id={}, type={}, eventType={}",
                        outbox.getId(), outbox.getAggregateType(), outbox.getEventType());
            }
        }
    }
}
