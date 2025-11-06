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
    private String grade;
    private List<SeatStatusDto> seats;
}