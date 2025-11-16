package com.stats.entity;


import com.stats.dto.MatchStatsAggregationDTO;
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
    private Long matchId;

    @Enumerated(EnumType.STRING)
    @Column(name="type", nullable = false)
    private MatchStats.Type type;

    @Column(name = "avg_date_select_time", nullable = false)
    private Float avgDateSelectTime;

    @Column(name = "avg_date_miss_count", nullable = false)
    private Float avgDateMissCount;

    @Column(name = "avg_seccode_select_time", nullable = false)
    private Float avgSeccodeSelectTime;

    @Column(name = "avg_seccode_backspace_count", nullable = false)
    private Float avgSeccodeBackspaceCount;

    @Column(name = "avg_seccode_try_count", nullable = false)
    private Float avgSeccodeTryCount;

    @Column(name = "avg_seat_select_time", nullable = false)
    private Float avgSeatSelectTime;

    @Column(name = "avg_seat_select_try_count", nullable = false)
    private Float avgSeatSelectTryCount;

    @Column(name = "avg_seat_select_click_miss_count", nullable = false)
    private Float avgSeatSelectClickMissCount;

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

    public void updateStats(MatchStatsAggregationDTO agg) {
        this.avgDateSelectTime = agg.getAvgDateSelectTime();
        this.avgDateMissCount = agg.getAvgDateMissCount();
        this.avgSeccodeSelectTime = agg.getAvgSeccodeSelectTime();
        this.avgSeccodeBackspaceCount = agg.getAvgSeccodeBackspaceCount();
        this.avgSeccodeTryCount = agg.getAvgSeccodeTryCount();
        this.avgSeatSelectTime = agg.getAvgSeatSelectTime();
        this.avgSeatSelectTryCount = agg.getAvgSeatSelectTryCount();
        this.avgSeatSelectClickMissCount = agg.getAvgSeatSelectClickMissCount();
    }

}
