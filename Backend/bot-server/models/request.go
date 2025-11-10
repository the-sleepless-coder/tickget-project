package models

// MatchSettingRequest 매치 시작 요청
type MatchSettingRequest struct {
	BotCount   int           `json:"botCount" binding:"required,min=1,max=50000"`          // 봇 개수
	StartTime  LocalDateTime `json:"startTime"`                                            // 티케팅 시작 시간
	Difficulty Difficulty    `json:"difficulty" binding:"required,oneof=EASY MEDIUM HARD"` // 난이도
	HallID     string        `json:"hallId" binding:"required"`                            // 공연장 ID
}
