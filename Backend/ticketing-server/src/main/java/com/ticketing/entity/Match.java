package com.ticketing.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "matches", indexes = {
        // roomId + status 조회 최적화 (WAITING 매치 중복 확인용)
        @Index(name = "idx_matches_room_status", columnList = "room_id, status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Match {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "match_id")
    private Long matchId;

    // 멱등성 키 (room이 생성해 전달, createMatch 재시도 중복 방지). 유니크 = 보조 인덱스 겸용.
    @Column(name = "idempotency_key", unique = true, length = 36)
    private String idempotencyKey;

    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @Column(name = "match_name", nullable = false, length = 100)
    private String matchName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Difficulty difficulty; // EASY, NORMAL, HARD

    @Column(name = "max_user", nullable = false)
    private Integer maxUser;

    @Column(name = "used_bot_count", nullable = false)
    private Integer usedBotCount;

    // @Column(name = "total_seats", nullable = false)
    // private Integer totalSeats;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private MatchStatus status; // WAITING, PLAYING, FINISHED

    @Column(name = "user_count")
    private Integer userCount;

    @Column(name = "success_user_count")
    private Integer successUserCount;

    @Column(name = "success_bot_count")
    private Integer successBotCount;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(name = "time_limit_seconds")
    private Integer timeLimitSeconds;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "update_at", nullable = false)
    private LocalDateTime updatedAt;


    public enum Difficulty {
        EASY, MEDIUM, HARD
    }

    public enum MatchStatus {
        WAITING, PLAYING, FINISHED, CANCELLED
    }
}
