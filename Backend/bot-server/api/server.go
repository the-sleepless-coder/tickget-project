package api

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"bot-server/bot"
	"bot-server/client"
	"bot-server/config"
	"bot-server/logger"
	"bot-server/match"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Server HTTP 서버 구조체
type Server struct {
	config     *config.Config
	engine     *gin.Engine
	httpServer *http.Server
}

// NewServer 새로운 서버 인스턴스를 생성
func NewServer(cfg *config.Config) *Server {
	// 프로덕션 모드 설정
	if os.Getenv("ENVIRONMENT") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Gin 엔진 생성
	engine := gin.New()

	// 미들웨어 설정
	engine.Use(gin.Recovery()) // panic 복구

	// Minio 클라이언트 생성
	minioClient, err := client.NewMinioClient(
		cfg.MinioEndpoint,
		cfg.MinioAccessKey,
		cfg.MinioSecretKey,
		cfg.MinioBucketName,
		cfg.MinioUseSSL,
		logger.Get(),
	)
	if err != nil {
		logger.Fatal("Minio 클라이언트 생성 실패", zap.Error(err))
	}

	// 도메인 서비스 생성
	botService := bot.NewService(cfg.MaxConcurrentBots)
	matchService := match.NewService(botService, minioClient)

	// 시스템 레벨 핸들러 (헬스체크)
	systemHandler := NewSystemHandler()
	systemHandler.RegisterRoutes(engine)

	// 도메인별 핸들러
	botHandler := bot.NewHandler(botService)
	botHandler.RegisterRoutes(engine)

	matchHandler := match.NewHandler(matchService)
	matchHandler.RegisterRoutes(engine)

	server := &Server{
		config: cfg,
		engine: engine,
	}

	return server
}

// Start 서버를 시작
func (s *Server) Start() error {
	s.httpServer = &http.Server{
		Addr:         ":" + s.config.ServerPort,
		Handler:      s.engine,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	logger.Info("Gin 서버 시작", zap.String("port", s.config.ServerPort))

	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("서버 시작 실패: %w", err)
	}

	return nil
}

// Shutdown 서버를 gracefully 종료
func (s *Server) Shutdown(ctx context.Context) error {
	logger.Info("서버 종료 중")

	if err := s.httpServer.Shutdown(ctx); err != nil {
		return fmt.Errorf("서버 종료 실패: %w", err)
	}

	logger.Info("서버 정상 종료됨")
	return nil
}
