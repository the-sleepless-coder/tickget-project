package com.ticketing.seat.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatInfo {
    private Long sectionId;  // 1
    private Long row;        // 9
    private Long col;        // 15

    /**
     * String 변환: "1-9-15"
     */
    public String toSeatId() {
        return sectionId + "-" + row + "-" + col;
    }

    /**
     * Redis 키용 rowNumber: "9-15"
     */
    public String toRowNumber() {
        return row + "-" + col;
    }
}