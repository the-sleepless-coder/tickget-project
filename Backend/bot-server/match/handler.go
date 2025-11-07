package match

import (
	"net/http"
	"strconv"

	"bot-server/logger"
	"bot-server/models"
	"bot-server/utils/httputil"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Handler 매치 HTTP 핸들러
type Handler struct {
	service *Service
}

// NewHandler 새로운 핸들러 인스턴스를 생성
func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

// RegisterRoutes 매치 관련 라우트를 등록
func (h *Handler) RegisterRoutes(router *gin.Engine) {
	matches := router.Group("/matches")
	{
		matches.POST("/:matchId/bots", h.SetBotsForMatch)
	}
}

// SetBotsForMatch 매치 시작 요청 처리
func (h *Handler) SetBotsForMatch(c *gin.Context) {
	// matchID 파싱
	matchID, err := parseMatchID(c)
	if err != nil {
		httputil.RespondWithError(c, http.StatusBadRequest, "유효하지 않은 matchId 형식입니다")
		return
	}

	// JSON 바인딩 및 검증
	var req models.MatchSettingRequest
	if !httputil.BindJSON(c, &req, "잘못된 매치 및 봇 세팅 요청") {
		return
	}

	logger.Info("매치 시작 요청됨",
		zap.Int64("match_id", matchID),
		zap.Int("bot_count", req.BotCount),
		zap.Time("start_time", req.StartTime),
	)

	// 매치를 위한 봇 세팅 시작
	if err := h.service.SetBotsForMatch(matchID, req); err != nil {
		logger.Error("매치 및 봇 세팅 실패",
			zap.Int64("match_id", matchID),
			zap.Error(err),
		)
		httputil.RespondWithError(c, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.RespondWithSuccess(c, http.StatusOK, models.MatchSettingResponse{
		Success: true,
		Message: "매치가 성공적으로 스케줄되었습니다",
		MatchID: matchID,
	})
}

// parseMatchID URL 파라미터에서 matchID를 파싱 (도메인 특화 헬퍼)
func parseMatchID(c *gin.Context) (int64, error) {
	matchIDStr := c.Param("matchId")
	return strconv.ParseInt(matchIDStr, 10, 64)
}
