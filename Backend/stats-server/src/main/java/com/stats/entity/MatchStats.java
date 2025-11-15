package com.stats.entity;


import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "match_stats")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long matchStatsId;

    @Column(name="match_id", nullable=false)
    private String matchId;

    @Enumerated(EnumType.STRING)
    @Column(name="type", nullable = false)
    private MatchStats.Type type;

    @Column(name = "avg_date_select_time", nullable = false)
    private Integer avgDateSelectTime;

    @Column(name = "avg_date_miss_count", nullable = false)
    private Integer avgDateMissCount;

    @Column(name = "avg_seccode_select_time", nullable = false)
    private Integer avgSeccodeSelectTime;

    @Column(name = "avg_seccode_backspace_count", nullable = false)
    private Integer avgSeccodeBackspaceCount;

    @Column(name = "avg_seccode_try_count", nullable = false)
    private Integer avgSeccodeTryCount;

    @Column(name = "avg_seat_select_time", nullable = false)
    private Integer avgSeatSelectTime;

    @Column(name = "avg_seat_select_try_count", nullable = false)
    private Integer avgSeatSelectTryCount;

    @Column(name = "avg_seat_select_click_miss_count", nullable = false)
    private Integer avgSeatSelectClickMissCount;

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

    public enum Type {
        PLAYER, BOT, ALL
    }

}
