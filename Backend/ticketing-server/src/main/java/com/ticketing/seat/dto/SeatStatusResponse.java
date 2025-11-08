package com.ticketing.seat.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatStatusResponse {
    private String sectionId;
    private List<SeatStatusDto> seats;  // 각 좌석에 grade 포함
}