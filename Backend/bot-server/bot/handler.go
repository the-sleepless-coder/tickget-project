package bot

import (
	"bot-server/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler 봇 HTTP 핸들러
type Handler struct {
	service *Service
}

// NewHandler 새로운 핸들러 인스턴스를 생성
func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

// RegisterRoutes 봇 관련 라우트를 등록
func (h *Handler) RegisterRoutes(router *gin.Engine) {
	router.GET("/bots/count", h.BotCount)
}

// BotCount 봇 리소스 현황 조회
func (h *Handler) BotCount(c *gin.Context) {
	total, available := h.service.GetCount()
	response := models.BotCountResponse{
		TotalBotCount:     total,
		AvailableBotCount: available,
	}

	c.JSON(http.StatusOK, response)
}
