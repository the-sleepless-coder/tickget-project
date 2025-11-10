package com.ticketing.seat.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatReservationRequest {
    private Long userId;
    private List<SeatInfo> seats;

    /**
     * @deprecated 각 좌석의 grade를 사용하세요 (하위 호환성 유지)
     * seats[].grade가 없을 경우에만 이 값을 사용합니다.
     */
    @Deprecated
    private String grade;  // 하위 호환성을 위해 유지

    private Integer totalSeats;

    /**
     * 첫 번째 좌석의 sectionId 반환 (Redis 키 생성용 - String 변환)
     */
    public String extractSectionId() {
        return seats != null && !seats.isEmpty()
                ? seats.get(0).getSectionId().toString()  // Long → String 변환
                : "";
    }
}