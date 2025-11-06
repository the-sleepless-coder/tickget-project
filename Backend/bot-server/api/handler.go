package api

import (
	"net/http"

	"bot-server/logger"
	"bot-server/manager"
	"bot-server/models"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Handler HTTP 요청 핸들러
type Handler struct {
	matchManager *manager.MatchManager
}

// NewHandler 새로운 핸들러 인스턴스를 생성합니다
func NewHandler(MaxConcurrentBots int) *Handler {
	return &Handler{
		matchManager: manager.NewMatchManager(MaxConcurrentBots),
	}
}

// RegisterRoutes 라우트를 등록합니다
func (h *Handler) RegisterRoutes(router *gin.Engine) {
	router.GET("/health", h.HealthCheck)
	router.GET("/ping", h.Ping)
	router.GET("/bots/count", h.BotCount)

	// 매치 관련 라우트
	match := router.Group("/match")
	{
		match.POST("/start", h.StartMatch)
	}
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

func (h *Handler) BotCount(c *gin.Context) {
	total, available := h.matchManager.GetBotCount()
	response := models.BotCountResponse{
		TotalBotCount:     total,
		AvailableBotCount: available,
	}

	c.JSON(http.StatusOK, response)
}

// StartMatch 매치 시작 요청 처리
func (h *Handler) StartMatch(c *gin.Context) {
	var req models.MatchStartRequest

	// JSON 바인딩 및 검증
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Warn("Invalid match start request",
			zap.Error(err),
		)
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	logger.Info("Match start requested",
		zap.String("match_id", req.MatchID),
		zap.Int("bot_count", req.BotCount),
		zap.Time("start_time", req.StartTime),
	)

	// 매치 시작
	if err := h.matchManager.StartMatch(req); err != nil {
		logger.Error("Failed to start match",
			zap.String("match_id", req.MatchID),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	response := models.MatchStartResponse{
		Success: true,
		Message: "Match scheduled successfully",
		MatchID: req.MatchID,
	}

	c.JSON(http.StatusOK, response)
}
