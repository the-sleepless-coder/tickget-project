package com.tickget.roomserver.dto.response;


import com.tickget.roomserver.domain.entity.PresetHall;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateHallResponse {
    private Long hallId;

    public static CreateHallResponse from(PresetHall hall) {
        return  CreateHallResponse.builder().hallId(hall.getId()).build();
    }
}
