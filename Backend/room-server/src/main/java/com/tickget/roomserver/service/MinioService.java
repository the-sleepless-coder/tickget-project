package com.tickget.roomserver.service;

import com.tickget.roomserver.exception.ImageUploadException;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import java.io.InputStream;
import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class MinioService {

    private final MinioClient minioClient;

    @Value("${minio.bucket-name}")
    private String bucketName;

    public String uploadFile(MultipartFile file) {
        try{
            String fileName = String.format("rooms/%s", file.getOriginalFilename());
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(fileName)
                            .stream(file.getInputStream(), file.getSize(), -1)
                            .contentType(file.getContentType())
                            .build()
            );

            return bucketName + "/" + fileName;
        } catch (Exception e){
            throw new ImageUploadException("이미지 업로드에 실패했습니다", e);
        }
    }

    public String uploadFile(InputStream inputStream, String fileName,
                             String contentType, long size) {
        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(fileName)
                            .stream(inputStream, size, -1)
                            .contentType(contentType)
                            .build()
            );

            return bucketName + "/" + fileName;
        } catch (Exception e) {
            throw new ImageUploadException("이미지 업로드에 실패했습니다", e);
        }
    }


}