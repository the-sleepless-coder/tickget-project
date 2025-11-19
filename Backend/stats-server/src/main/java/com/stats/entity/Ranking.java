package com.stats.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "ranking")
public class Ranking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;  // 랭킹 ID

    @Column(name = "user_id", nullable = false)
    private Long userId;  // 회원 ID

    @Column(name="season_id", nullable = false)
    private Long seasonId;

    @Column(name = "points", nullable = false)
    private Integer points;  // 점수

    @Column(name = "user_rank", nullable = false)
    private Integer userRank;  // 순위

//    @Enumerated(EnumType.STRING)
//    @Column(name = "grade")
//    private Grade grade;  // S / A / B / C

    @Column(name = "snapshot_at", nullable = false)
    private LocalDateTime snapshotAt;

    @Enumerated(EnumType.STRING)
    @Column(name="snapshot_round", nullable = false)
    private SnapshotRound snapshotRound;

    @Column(name = "snapshot_no", nullable = false)
    private Integer snapshotNo;

    @Column(name ="tot_player", nullable = false)
    private Integer totPlayer;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum SnapshotRound{
        MORNING, EVENING;
    }

//    /** 등급 ENUM */
//    public enum Grade {
//        S, A, B, C
//    }

}