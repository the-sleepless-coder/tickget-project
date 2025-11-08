package com.tickget.roomserver.service;

import com.tickget.roomserver.domain.entity.PresetHall;
import com.tickget.roomserver.domain.repository.PresetHallRepository;
import com.tickget.roomserver.dto.request.CreateHallRequest;
import com.tickget.roomserver.dto.response.CreateHallResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class HallService {

    private final PresetHallRepository hallRepository;

    @Transactional
    public CreateHallResponse createHall(CreateHallRequest request) {
        PresetHall hall = PresetHall.from(request);
        hall = hallRepository.save(hall);
        return CreateHallResponse.from(hall);
    }
}
