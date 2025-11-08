package client

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

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
	// 객체 이름: halls/{hallID}/layout.json
	objectName := fmt.Sprintf("halls/%s/layout.json", hallID)

	mc.logger.Debug("공연장 좌석 정보 조회 시작",
		zap.String("hall_id", hallID),
		zap.String("object_name", objectName),
	)

	// Minio에서 객체 가져오기
	object, err := mc.client.GetObject(ctx, mc.bucketName, objectName, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("Minio 객체 조회 실패: %w", err)
	}
	defer object.Close()

	// 객체 존재 여부 확인
	stat, err := object.Stat()
	if err != nil {
		return nil, fmt.Errorf("공연장 정보를 찾을 수 없습니다 (hall_id: %s): %w", hallID, err)
	}

	mc.logger.Debug("공연장 파일 찾음",
		zap.String("hall_id", hallID),
		zap.Int64("size", stat.Size),
	)

	// JSON 파싱
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
