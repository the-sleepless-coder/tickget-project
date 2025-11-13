package com.tickget.roomserver.service;

import com.tickget.roomserver.exception.FileUploadException;
import lombok.RequiredArgsConstructor;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ThumbnailService {

    private final MinioService minioService;

    private static final int THUMBNAIL_WIDTH = 300;
    private static final double JPEG_QUALITY = 0.85;

    public String uploadThumbnail(MultipartFile file) {
        // 1. MIME type 검증
        validateImageType(file);

        // 2. 원본 파일명과 확장자 추출
        String originalFilename = file.getOriginalFilename();
        String extension = extractExtension(originalFilename);
        String format = getFormatFromExtension(extension);

        try {
            // 3. 리사이징
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

            Thumbnails.of(file.getInputStream())
                    .width(THUMBNAIL_WIDTH)           // 가로 300px 고정
                    .keepAspectRatio(true)            // 세로 비율 유지
                    .outputFormat(format)             // 원본 포맷 유지
                    .outputQuality(JPEG_QUALITY)      // JPEG 품질 (PNG는 무시됨)
                    .toOutputStream(outputStream);

            // 4. InputStream으로 변환
            byte[] thumbnailBytes = outputStream.toByteArray();
            InputStream thumbnailInputStream = new ByteArrayInputStream(thumbnailBytes);

            // 5. 파일명 생성
            String fileName = String.format("rooms/%s%s", UUID.randomUUID(), extension);

            // 6. MinIO에 업로드
            return minioService.uploadFile(
                    thumbnailInputStream,
                    fileName,
                    file.getContentType(),
                    thumbnailBytes.length
            );

        } catch (Exception e) {
            throw new FileUploadException("썸네일 생성 및 업로드에 실패했습니다", e);
        }
    }

    private void validateImageType(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType == null ||
                (!contentType.equals("image/jpeg") && !contentType.equals("image/png"))) {
            throw new FileUploadException("지원하지 않는 이미지 형식입니다. JPEG 또는 PNG만 가능합니다.");
        }
    }

    private String extractExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            throw new FileUploadException("유효하지 않은 파일명입니다");
        }
        return filename.substring(filename.lastIndexOf("."));
    }

    private String getFormatFromExtension(String extension) {
        // .jpg, .jpeg → jpg
        // .png → png
        if (extension.equalsIgnoreCase(".jpg") || extension.equalsIgnoreCase(".jpeg")) {
            return "jpg";
        } else if (extension.equalsIgnoreCase(".png")) {
            return "png";
        }
        throw new FileUploadException("지원하지 않는 파일 확장자입니다");
    }
}