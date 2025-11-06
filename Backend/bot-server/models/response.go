package models

type BotCountResponse struct {
	TotalBotCount     int `json: "total_bot_count"`
	AvailableBotCount int `json: "available_bot_count"`
}

// MatchStartResponse 매치 시작 응답
type MatchStartResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	MatchID int64  `json:"match_id"`
}

// ErrorResponse 에러 응답
type ErrorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}
