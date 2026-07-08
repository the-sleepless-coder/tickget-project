package com.ticketing.entity;

import jakarta.persistence.*;
import lombok.*;
import jakarta.persistence.GenerationType;

import java.time.LocalDateTime;

// 범용 Outbox 패턴을 저장하기 위한 테이블
// Entity를 이용해 테이블 생성, POJO형태로 테이블을 Spring내에서 다룸.
@Entity
@Table(name="outbox_event")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Outbox{
    @Id @GeneratedValue(strategy= GenerationType.IDENTITY)
    private Long id;

    // 이벤트 발행 타입(Match)
    @Enumerated(EnumType.STRING)
    @Column(name = "aggregate_type", nullable = false)
    private AggregateType aggregateType;

    // 이벤트 발행하는 테이블의 id(eg.match_id)
    @Column(name = "aggregate_id", nullable = false)
    private Long aggregateId;
    // 이벤트 형식(MATCH_START)
    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OutboxStatus status;

    @Column(name = "retry_count", nullable = false)
    private int retryCount;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdTime;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    public enum AggregateType{
        TICKETING, BOT, ROOM, AUTH
    }

    public enum OutboxStatus{
        PENDING, PUBLISHED, FAILED
    }
}
