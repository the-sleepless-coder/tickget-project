package models

import "time"

// MatchSettingRequest 매치 시작 요청
type MatchSettingRequest struct {
	BotCount   int        `json:"botCount" binding:"required,min=1,max=50000"`          // 봇 개수
	StartTime  time.Time  `json:"startTime" binding:"required"`                         // 티케팅 시작 시간
	Difficulty Difficulty `json:"difficulty" binding:"required,oneof=EASY MEDIUM HARD"` // 난이도
}
