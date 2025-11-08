package api

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"bot-server/config"
	"bot-server/logger"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Server HTTP 서버 구조체
type Server struct {
	config     *config.Config
	engine     *gin.Engine
	httpServer *http.Server
	handler    *Handler
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

	// 핸들러 생성 및 라우트 등록
	handler := NewHandler(cfg.MaxConcurrentBots)
	handler.RegisterRoutes(engine)

	server := &Server{
		config:  cfg,
		engine:  engine,
		handler: handler,
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
