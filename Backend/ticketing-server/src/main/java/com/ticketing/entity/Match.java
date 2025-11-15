package com.ticketing.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "matches")
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
        WAITING, PLAYING, FINISHED
    }
}
