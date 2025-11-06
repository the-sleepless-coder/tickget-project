package api

import (
	"net/http"
	"strconv"

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

// NewHandler 새로운 핸들러 인스턴스를 생성
func NewHandler(MaxConcurrentBots int) *Handler {
	return &Handler{
		matchManager: manager.NewMatchManager(MaxConcurrentBots),
	}
}

// RegisterRoutes 라우트를 등록합
func (h *Handler) RegisterRoutes(router *gin.Engine) {
	router.GET("/health", h.HealthCheck)
	router.GET("/bots/count", h.BotCount)

	// 매치 관련 라우트
	matches := router.Group("/matches")
	{
		matches.POST("/:matchId/bots", h.SetBotsForMatch)
	}
}

// HealthCheck 서버 상태 확인 엔드포인트
func (h *Handler) HealthCheck(c *gin.Context) {
	response := gin.H{
		"status":  "healthy",
		"service": "bot-server",
	}

	logger.Debug("헬스체크 요청됨")
	c.JSON(http.StatusOK, response)
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
func (h *Handler) SetBotsForMatch(c *gin.Context) {
	matchIDStr := c.Param("matchId")
	matchID, err := strconv.ParseInt(matchIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success: false,
			Error:   "유효하지 않은 matchId 형식입니다",
		})
		return
	}

	// JSON 바인딩 및 검증
	var req models.MatchSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Warn("잘못된 매치 및 봇 세팅 요청",
			zap.Error(err),
		)
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	logger.Info("매치 시작 요청됨",
		zap.Int64("match_id", matchID),
		zap.Int("bot_count", req.BotCount),
		zap.Time("start_time", req.StartTime),
	)

	//매치를 위한 봇 세팅 시작
	if err := h.matchManager.SetBotsForMatch(matchID, req); err != nil {
		logger.Error("매치 및 봇 세팅 실패",
			zap.Int64("match_id", matchID),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	response := models.MatchSettingResponse{
		Success: true,
		Message: "매치가 성공적으로 스케줄되었습니다",
		MatchID: matchID,
	}

	c.JSON(http.StatusOK, response)
}
