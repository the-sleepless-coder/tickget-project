package com.tickget.roomserver.dto.request;


import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class CreateHallRequest {
    private String name;
    private int totalSeat;
}
