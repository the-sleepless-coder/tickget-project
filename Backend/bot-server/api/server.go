package api

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"bot-server/config"
	"bot-server/logger"

	"go.uber.org/zap"
)

// Server HTTP 서버 구조체
type Server struct {
	config     *config.Config
	httpServer *http.Server
	handler    *Handler
}

// NewServer 새로운 서버 인스턴스를 생성합니다
func NewServer(cfg *config.Config) *Server {
	handler := NewHandler()

	server := &Server{
		config:  cfg,
		handler: handler,
	}

	return server
}

// Start 서버를 시작합니다
func (s *Server) Start() error {
	mux := http.NewServeMux()

	// 라우트 등록
	s.handler.RegisterRoutes(mux)

	s.httpServer = &http.Server{
		Addr:         ":" + s.config.ServerPort,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	logger.Info("Starting server", zap.String("port", s.config.ServerPort))

	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("server failed to start: %w", err)
	}

	return nil
}

// Shutdown 서버를 gracefully 종료합니다
func (s *Server) Shutdown(ctx context.Context) error {
	logger.Info("Shutting down server")

	if err := s.httpServer.Shutdown(ctx); err != nil {
		return fmt.Errorf("server shutdown failed: %w", err)
	}

	logger.Info("Server stopped gracefully")
	return nil
}
