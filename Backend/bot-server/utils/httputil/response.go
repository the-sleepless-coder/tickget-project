package httputil

import (
	"net/http"

	"bot-server/logger"
	"bot-server/models"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// RespondWithError 에러 응답을 반환
func RespondWithError(c *gin.Context, statusCode int, message string) {
	c.JSON(statusCode, models.ErrorResponse{
		Success: false,
		Error:   message,
	})
}

// RespondWithSuccess 성공 응답을 반환
func RespondWithSuccess(c *gin.Context, statusCode int, data interface{}) {
	c.JSON(statusCode, data)
}

// BindJSON JSON 요청을 바인딩하고 에러를 처리
func BindJSON(c *gin.Context, target interface{}, logMessage string) bool {
	if err := c.ShouldBindJSON(target); err != nil {
		logger.Warn(logMessage, zap.Error(err))
		RespondWithError(c, http.StatusBadRequest, err.Error())
		return false
	}
	return true
}
