package com.tickget.roomserver.controller;


import com.tickget.roomserver.dto.request.CreateHallRequest;
import com.tickget.roomserver.dto.response.CreateHallResponse;
import com.tickget.roomserver.service.HallService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


@Slf4j
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("halls")
@RequiredArgsConstructor
public class HallController {

    private final HallService hallService;

    @PostMapping
    public ResponseEntity<CreateHallResponse> createHall(@RequestBody CreateHallRequest request) {
        return ResponseEntity.ok(
                hallService.createHall(request));
    }
}
