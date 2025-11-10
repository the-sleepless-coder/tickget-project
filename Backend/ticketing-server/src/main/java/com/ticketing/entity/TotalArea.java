package com.ticketing.entity;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "id")
@Entity
@Table(
        name = "total_area",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_total_area_kopis", columnNames = "kopis_id")
        },
        indexes = {
                @Index(name = "idx_total_area_kopis", columnList = "kopis_id")
        }
)
public class TotalArea {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 시설명 */
    @Column(name = "name", nullable = false, length = 200)
    private String name;

    /** KOPIS 시설 ID (FC000175 같은 값) */
    @Column(name = "kopis_id", nullable = false, length = 32)
    private String kopisId;

    /** 총 좌석 수 */
    @Column(name = "total_seat", nullable = false)
    private int totalSeat;

    /** 세부 공연장들 (1:N, 비식별 FK) */
    @OneToMany(
            mappedBy = "totalArea",
            fetch = FetchType.LAZY
            // cascade, orphanRemoval은 FK가 RESTRICT라 기본 미설정 권장
    )
    @Builder.Default
    private List<SmallConcertHall> smallConcertHalls = new ArrayList<>();

    /** 편의 메서드 (양방향 관계 세팅) */
    public void addSmallHall(SmallConcertHall hall) {
        smallConcertHalls.add(hall);
        hall.setTotalArea(this);
    }
}

