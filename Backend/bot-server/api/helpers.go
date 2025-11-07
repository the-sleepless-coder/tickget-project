package api

import (
	"net/http"
	"strconv"

	"bot-server/logger"
	"bot-server/models"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// 에러 응답을 반환
func respondWithError(c *gin.Context, statusCode int, message string) {
	c.JSON(statusCode, models.ErrorResponse{
		Success: false,
		Error:   message,
	})
}

// respondWithSuccess 성공 응답을 반환
func respondWithSuccess(c *gin.Context, statusCode int, data interface{}) {
	c.JSON(statusCode, data)
}

// URL 파라미터에서 matchID를 파싱
func parseMatchID(c *gin.Context) (int64, error) {
	matchIDStr := c.Param("matchId")
	return strconv.ParseInt(matchIDStr, 10, 64)
}

// JSON 요청을 바인딩하고 에러를 처리
func bindJSON(c *gin.Context, target interface{}, logMessage string) bool {
	if err := c.ShouldBindJSON(target); err != nil {
		logger.Warn(logMessage, zap.Error(err))
		respondWithError(c, http.StatusBadRequest, err.Error())
		return false
	}
	return true
}
