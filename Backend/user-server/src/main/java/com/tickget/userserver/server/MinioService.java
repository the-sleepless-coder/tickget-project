package com.tickget.userserver.server;

import io.minio.*;
import io.minio.messages.Item;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
@RequiredArgsConstructor
public class MinioService {

    private final MinioClient minioClient;

    @Value("${minio.bucket-name}")
    private String bucketName;

    @Value("${minio.url}")
    private String minioUrl;

    /**
     * 프로필 이미지 업로드
     * 경로: users/{userId}/profile_img.{extension}
     */
    public String uploadProfileImage(Long userId, MultipartFile file) {
        try {
            // 버킷 존재 여부 확인
            ensureBucketExists();

            // 파일 확장자 추출
            // String originalFilename = file.getOriginalFilename(); // 이미지명 고정을 위해 확장자가 필요 없음(content-type에 적힘)
            // String extension = getFileExtension(originalFilename);

            // 객체 키 생성: users/{userId}/profile_img.{extension}
            // String objectName = String.format("users/%d/profile_img.%s", userId, extension);
            String objectName = String.format("users/%d/profile", userId); // 유저 프로필 이미지명고정

            // 파일 업로드
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectName)
                            .stream(file.getInputStream(), file.getSize(), -1)
                            .contentType(file.getContentType())
                            .build()
            );

            log.info("프로필 이미지 업로드 완료 - userId: {}, objectName: {}", userId, objectName);

            // 전체 URL 반환
            return String.format("%s/%s/%s", minioUrl, bucketName, objectName);

        } catch (Exception e) {
            log.error("프로필 이미지 업로드 실패 - userId: {}, error: {}", userId, e.getMessage(), e);
            throw new RuntimeException("프로필 이미지 업로드에 실패했습니다.", e);
        }
    }

    /**
     * 프로필 이미지 삭제
     */
    public void deleteProfileImage(Long userId) {
        try {
            // users/{userId}/ 경로의 모든 파일 삭제
            String prefix = String.format("users/%d/", userId);

            Iterable<Result<Item>> results = minioClient.listObjects(
                    ListObjectsArgs.builder()
                            .bucket(bucketName)
                            .prefix(prefix)
                            .recursive(true)
                            .build()
            );

            for (Result<Item> result : results) {
                String objectName = result.get().objectName();
                minioClient.removeObject(
                        RemoveObjectArgs.builder()
                                .bucket(bucketName)
                                .object(objectName)
                                .build()
                );
                log.info("프로필 이미지 삭제 완료 - objectName: {}", objectName);
            }

        } catch (Exception e) {
            log.error("프로필 이미지 삭제 실패 - userId: {}, error: {}", userId, e.getMessage(), e);
            throw new RuntimeException("프로필 이미지 삭제에 실패했습니다.", e);
        }
    }

    /**
     * 버킷 존재 여부 확인 및 생성
     */
    private void ensureBucketExists() throws Exception {
        boolean found = minioClient.bucketExists(
                BucketExistsArgs.builder()
                        .bucket(bucketName)
                        .build()
        );

        if (!found) {
            minioClient.makeBucket(
                    MakeBucketArgs.builder()
                            .bucket(bucketName)
                            .build()
            );
            log.info("MinIO 버킷 생성됨: {}", bucketName);
        }
    }

    /**
     * 파일 확장자 추출
     */
    // private String getFileExtension(String filename) {
    //     if (filename == null || !filename.contains(".")) {
    //         return "png";
    //     }
    //     return filename.substring(filename.lastIndexOf(".") + 1);
    // }
}