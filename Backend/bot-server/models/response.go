package models

// MatchStartResponse 매치 시작 응답
type MatchStartResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	MatchID string `json:"match_id"`
}

// ErrorResponse 에러 응답
type ErrorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}
