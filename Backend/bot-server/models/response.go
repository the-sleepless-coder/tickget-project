package models

type BotCountResponse struct {
	TotalBotCount     int `json:"totalBotCount"`
	AvailableBotCount int `json:"availableBotCount"`
}

// MatchSettingResponse 매치 시작 응답
type MatchSettingResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	MatchID int64  `json:"matchId"`
}

// ErrorResponse 에러 응답
type ErrorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}
