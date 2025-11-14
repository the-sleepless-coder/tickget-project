package com.tickget.authserver.service;

import io.minio.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.Random;

/**
 * 프로필 이미지 관리 서비스
 * OAuth 로그인 시 기본 프로필 이미지를 S3에 업로드
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProfileImageService {

    private final MinioClient minioClient;
    private final Random random = new Random();

    @Value("${minio.bucket-name}")
    private String bucketName;

    @Value("${minio.url}")
    private String minioUrl;

    @Value("${minio.default-profile-count}")
    private int defaultProfileCount;

    /**
     * 기본 프로필 이미지를 랜덤으로 선택하여 사용자 S3에 복사
     * 경로: users/{userId}/profile.jpg
     *
     * @param userId 사용자 ID
     * @return S3 URL (예: https://s3.tickget.kr/tickget-dev/users/123/profile.jpg)
     */
    public String copyRandomDefaultProfileImage(Long userId) {
        try {
            // 버킷 존재 여부 확인
            ensureBucketExists();

            // 1. 랜덤 이미지 선택 (1 ~ defaultProfileCount)
            int randomNum = random.nextInt(defaultProfileCount) + 1;
            String defaultImagePath = "static/default-profiles/image" + randomNum + ".jpg";

            log.info("기본 프로필 이미지 선택 - userId: {}, imagePath: {}", userId, defaultImagePath);

            // 2. resources에서 이미지 읽기
            ClassPathResource resource = new ClassPathResource(defaultImagePath);
            InputStream inputStream = resource.getInputStream();
            long fileSize = resource.contentLength();

            // 3. S3에 업로드 (users/{userId}/profile.jpg)
            String objectName = String.format("users/%d/profile", userId);

            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectName)
                            .stream(inputStream, fileSize, -1)
                            .contentType("image/jpeg")
                            .build()
            );

            log.info("프로필 이미지 업로드 완료 - userId: {}, objectName: {}", userId, objectName);

            // 4. S3 URL 반환
            String s3Url = String.format("%s/%s/%s", minioUrl, bucketName, objectName);
            log.info("프로필 이미지 URL 생성 - userId: {}, url: {}", userId, s3Url);

            return s3Url;

        } catch (Exception e) {
            log.error("프로필 이미지 업로드 실패 - userId: {}, error: {}", userId, e.getMessage(), e);
            throw new RuntimeException("프로필 이미지 업로드에 실패했습니다.", e);
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
}
