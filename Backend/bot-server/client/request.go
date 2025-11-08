package client

//클라언트에서 제공하는 요청 양식

// 공연 날짜/회차 선택 요청
type DaySelectRequest struct {
	ClickMiss int `json:"clickmiss"`
	Duration  int `json:"duration"`
}

// 캡챠 검증 요청
type ValidateCaptchaRequest struct {
	UserId int64 `json:"userId"`
}

//섹션 내 좌석 상태 요청
type SectionStatusRequest struct {
	UserId int64 `json:"userId"`
}

// 좌석 선택 요청
type SeatSelectRequest struct {
	UserId  int64    `json:"userId"`
	SeatIds []string `json:"seatIds"`
}

// 좌석 확정 요청 (필드 미정)
type SeatConfirmRequest struct {
	UserId  int64    `json:"userId"`
	SeatIds []string `json:"seatIds"`
}
