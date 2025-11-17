package com.stats.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "user_stats")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
//@org.hibernate.annotations.Immutable  // 읽기 전용으로 설정 (다른 테이블용)
public class UserStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "match_id", nullable = false)
    private Long matchId;

    @Column(name = "is_success", nullable = false)
    private Boolean isSuccess;

    @Column(name = "selected_section", nullable = false, length = 20)
    private String selectedSection;

    @Column(name = "selected_seat", nullable = false, length = 20)
    private String selectedSeat;

    @Column(name = "date_select_time", nullable = false)
    private float dateSelectTime;

    @Column(name = "date_miss_count", nullable = false)
    private Integer dateMissCount;

    @Column(name = "seccode_select_time", nullable = false)
    private float seccodeSelectTime;

    @Column(name = "seccode_backspace_count", nullable = false)
    private Integer seccodeBackspaceCount;

    @Column(name = "seccode_try_count", nullable = false)
    private Integer seccodeTryCount;

    @Column(name = "seat_select_time", nullable = false)
    private float seatSelectTime;

    @Column(name = "seat_select_try_count", nullable = false)
    private Integer seatSelectTryCount;

    @Column(name = "seat_select_click_miss_count", nullable = false)
    private Integer seatSelectClickMissCount;

    @Column(name = "user_rank", nullable = false)
    private Integer userRank;

    @Column(name = "total_rank", nullable = false)
    private Integer totalRank;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // JPA스러운 방식으로 가져온다.
    // 애초에 user_stats에서 match_id가 존재해야 matches에서 조회 가능.
    /**
     * @ManyToOne(fetch = FetchType.LAZY)
     *     @JoinColumn(name = "match_id", insertable = false, updatable = false)
     *     private Match match;
     **/


}