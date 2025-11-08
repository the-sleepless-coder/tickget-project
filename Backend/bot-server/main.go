package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"bot-server/api"
	"bot-server/config"
	"bot-server/logger"

	"go.uber.org/zap"
)

func main() {
	// 설정 로드 (.env 파일 로드 포함)
	cfg := config.Load()

	// 로거 초기화 (개발 모드)
	isDev := os.Getenv("ENVIRONMENT") != "production"
	if err := logger.Init(isDev); err != nil {
		panic("로거 초기화 실패: " + err.Error())
	}
	defer logger.Sync()

	// 서버 생성
	server := api.NewServer(cfg)

	// 서버를 별도의 goroutine에서 시작
	go func() {
		if err := server.Start(); err != nil {
			logger.Fatal("서버 시작 실패", zap.Error(err))
		}
	}()

	logger.Info("봇 서버 실행 중")

	// Graceful shutdown을 위한 시그널 처리
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// 종료 시그널 대기
	<-quit
	logger.Info("종료 신호 수신")

	// 5초 타임아웃으로 graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Fatal("서버 강제 종료", zap.Error(err))
	}

	logger.Info("봇 서버 종료됨")
}
