package api

import (
	"net/http"

	"bot-server/logger"

	"github.com/gin-gonic/gin"
)

// Handler HTTP 요청 핸들러
type Handler struct {
	// 나중에 manager 등을 추가할 예정
}

// NewHandler 새로운 핸들러 인스턴스를 생성합니다
func NewHandler() *Handler {
	return &Handler{}
}

// RegisterRoutes 라우트를 등록합니다
func (h *Handler) RegisterRoutes(router *gin.Engine) {
	router.GET("/health", h.HealthCheck)
	router.GET("/ping", h.Ping)
}

// HealthCheck 서버 상태 확인 엔드포인트
func (h *Handler) HealthCheck(c *gin.Context) {
	response := gin.H{
		"status":  "healthy",
		"service": "bot-server",
	}

	logger.Debug("Health check requested")
	c.JSON(http.StatusOK, response)
}

// Ping 간단한 ping 엔드포인트
func (h *Handler) Ping(c *gin.Context) {
	logger.Debug("Ping requested")
	c.JSON(http.StatusOK, gin.H{"message": "pong"})
}
