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
	// 로거 초기화 (개발 모드)
	isDev := os.Getenv("ENVIRONMENT") != "production"
	if err := logger.Init(isDev); err != nil {
		panic("Failed to initialize logger: " + err.Error())
	}
	defer logger.Sync()

	// 설정 로드
	cfg := config.Load()

	// 서버 생성
	server := api.NewServer(cfg)

	// 서버를 별도의 goroutine에서 시작
	go func() {
		if err := server.Start(); err != nil {
			logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	logger.Info("Bot server is running")

	// Graceful shutdown을 위한 시그널 처리
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// 종료 시그널 대기
	<-quit
	logger.Info("Received shutdown signal")

	// 5초 타임아웃으로 graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", zap.Error(err))
	}

	logger.Info("Bot server exited")
}
