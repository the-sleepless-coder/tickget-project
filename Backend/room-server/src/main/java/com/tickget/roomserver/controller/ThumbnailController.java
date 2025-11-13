package com.tickget.roomserver.controller;

import com.tickget.roomserver.dto.response.ThumbnailUploadResponse;
import com.tickget.roomserver.service.ThumbnailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("thumbnail")
@RequiredArgsConstructor
public class ThumbnailController {

    private final ThumbnailService thumbnailService;

    @PostMapping
    public ResponseEntity<ThumbnailUploadResponse> uploadThumbnail(
            @RequestParam("file") MultipartFile file) {

        String thumbnailUrl = thumbnailService.uploadThumbnail(file);

        return ResponseEntity.ok(new ThumbnailUploadResponse(thumbnailUrl));
    }
}
