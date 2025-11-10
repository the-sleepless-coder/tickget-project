package com.ticketing.entity;
import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "id")
@Entity
@Table(
        name = "small_concert_halls",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_small_hall_spec", columnNames = "concert_hall_id")
        },
        indexes = {
                @Index(name = "idx_small_hall_total_area_id", columnList = "total_area_id"),
                @Index(name = "idx_small_hall_spec_id", columnList = "concert_hall_id")
        }
)
public class SmallConcertHall {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 부모 FK: total_area.id */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "total_area_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "fk_small_hall_total_area")
    )
    private TotalArea totalArea;

    /** 세부 공연장명 (specname) */
    @Column(name = "name", nullable = false, length = 200)
    private String name;

    /** 세부 공연장 ID (specId: FC000175-01 같은 값) */
    @Column(name = "concert_hall_id", nullable = false, length = 32)
    private String concertHallId;

    /** 세부 좌석 수 (specseatNum) */
    @Column(name = "total_seat", nullable = false)
    private int totalSeat;
}

