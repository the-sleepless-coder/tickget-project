package models

import "time"

// MatchStartRequest 매치 시작 요청
type MatchStartRequest struct {
	MatchID   string    `json:"match_id" binding:"required"`   // 매치 ID
	BotCount  int       `json:"bot_count" binding:"required,min=1,max=50000"` // 봇 개수
	StartTime time.Time `json:"start_time" binding:"required"` // 티케팅 시작 시간
}
