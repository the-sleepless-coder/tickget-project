package com.ticketing.seat.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatHoldRequest {

    private Long userId;
    private List<String> seatIds;
    private String sectionId;
    private String grade;
}
