package com.ticketing.repository;

import com.ticketing.entity.Outbox;
import com.ticketing.entity.UserStats;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface OutboxRepository extends JpaRepository<Outbox, Long> {
    List<Outbox> findByStatusAndRetryCountLessThanAndCreatedTimeBefore(
            Outbox.OutboxStatus status, int retryCount, LocalDateTime before
    );

    List<Outbox> findByStatusAndRetryCountGreaterThanEqual(
            Outbox.OutboxStatus status, int retryCount
    );
}
