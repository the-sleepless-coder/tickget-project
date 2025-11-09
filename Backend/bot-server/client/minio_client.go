package client

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"bot-server/models"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"go.uber.org/zap"
)

// Minio 클라이언트
type MinioClient struct {
	client     *minio.Client
	bucketName string
	logger     *zap.Logger
}

// 새로운 Minio 클라이언트를 생성
func NewMinioClient(endpoint, accessKey, secretKey, bucketName string, useSSL bool, logger *zap.Logger) (*MinioClient, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("Minio 클라이언트 생성 실패: %w", err)
	}

	logger.Info("Minio 클라이언트 생성됨",
		zap.String("endpoint", endpoint),
		zap.String("bucket", bucketName),
	)

	return &MinioClient{
		client:     client,
		bucketName: bucketName,
		logger:     logger,
	}, nil
}

// 공연장 좌석 정보를 조회
func (mc *MinioClient) GetHallLayout(ctx context.Context, hallID string) (*models.HallLayout, error) {
	prefix := fmt.Sprintf("halls/%s/", hallID)

	mc.logger.Debug("공연장 좌석 정보 조회 시작",
		zap.String("hall_id", hallID),
		zap.String("prefix", prefix),
	)

	// 1) prefix 아래 json 파일 찾기
	var targetObjectName string
	for objectInfo := range mc.client.ListObjects(ctx, mc.bucketName, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	}) {
		if objectInfo.Err != nil {
			return nil, fmt.Errorf("객체 목록 조회 실패: %w", objectInfo.Err)
		}

		// .json 파일만 대상
		if strings.HasSuffix(objectInfo.Key, ".json") {
			targetObjectName = objectInfo.Key
			break // 첫 번째 json 파일만 사용
		}
	}

	if targetObjectName == "" {
		return nil, fmt.Errorf("공연장 정보를 찾을 수 없습니다 (hall_id: %s): json 파일 없음", hallID)
	}

	mc.logger.Debug("공연장 파일 찾음",
		zap.String("hall_id", hallID),
		zap.String("object_name", targetObjectName),
	)

	// 2) 찾은 json 파일 가져오기
	object, err := mc.client.GetObject(ctx, mc.bucketName, targetObjectName, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("Minio 객체 조회 실패: %w", err)
	}
	defer object.Close()

	// stat으로 한 번 더 확인하고 싶다면
	stat, err := object.Stat()
	if err != nil {
		return nil, fmt.Errorf("공연장 정보를 찾을 수 없습니다 (hall_id: %s): %w", hallID, err)
	}

	mc.logger.Debug("공연장 파일 stat 확인",
		zap.String("hall_id", hallID),
		zap.Int64("size", stat.Size),
	)

	// 3) JSON 파싱
	data, err := io.ReadAll(object)
	if err != nil {
		return nil, fmt.Errorf("공연장 정보 읽기 실패: %w", err)
	}

	var layout models.HallLayout
	if err := json.Unmarshal(data, &layout); err != nil {
		return nil, fmt.Errorf("공연장 정보 파싱 실패: %w", err)
	}

	mc.logger.Info("공연장 좌석 정보 로드 완료",
		zap.String("hall_id", hallID),
		zap.Int("sections", len(layout.Sections)),
	)

	return &layout, nil
}
