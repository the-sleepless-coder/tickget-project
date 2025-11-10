package api

import (
	"net/http"

	"bot-server/logger"

	"github.com/gin-gonic/gin"
)

// SystemHandler 시스템 레벨 HTTP 핸들러 (헬스체크 등)
type SystemHandler struct{}

// NewSystemHandler 새로운 시스템 핸들러 인스턴스를 생성
func NewSystemHandler() *SystemHandler {
	return &SystemHandler{}
}

// RegisterRoutes 시스템 라우트를 등록
func (h *SystemHandler) RegisterRoutes(router *gin.Engine) {
	router.GET("/health", h.HealthCheck)

}

// HealthCheck 서버 상태 확인 엔드포인트
func (h *SystemHandler) HealthCheck(c *gin.Context) {
	response := gin.H{
		"status":  "healthy",
		"service": "bot-server",
	}

	logger.Debug("헬스체크 요청됨")
	c.JSON(http.StatusOK, response)
}
