package client

//클라언트에서 제공하는 요청 양식

// 공연 날짜/회차 선택 요청
type DaySelectRequest struct {
	ClickMiss int     `json:"clickmiss"`
	Duration  float64 `json:"duration"` // 초 단위 (s)
}

// 캡챠 검증 요청
type ValidateCaptchaRequest struct {
	UserId int64 `json:"userId"`
}

//섹션 내 좌석 상태 요청
type SectionStatusRequest struct {
	UserId int64 `json:"userId"`
}

// 좌석 정보 (Spring의 SeatInfo와 일치)
type SeatInfo struct {
	SectionId int64  `json:"sectionId"`
	Row       int64  `json:"row"`
	Col       int64  `json:"col"`
	Grade     string `json:"grade"`
}

// 좌석 선택 요청
type SeatSelectRequest struct {
	UserId     int64      `json:"userId"`
	Seats      []SeatInfo `json:"seats"`      // seatIds → seats, string → SeatInfo
	TotalSeats int        `json:"totalSeats"` // 봇은 0으로 고정
}

// 좌석 확정 요청
type SeatConfirmRequest struct {
	UserId                   int64   `json:"userId"`
	DateSelectTime           float32 `json:"dateSelectTime"`
	SeccodeSelectTime        float32 `json:"seccodeSelectTime"`
	SeccodeBackspaceCount    int     `json:"seccodeBackspaceCount"`
	SeccodeTryCount          int     `json:"seccodeTryCount"`
	SeatSelectTime           float32 `json:"seatSelectTime"`
	SeatSelectTryCount       int     `json:"seatSelectTryCount"`
	SeatSelectClickMissCount int     `json:"seatSelectClickMissCount"`
}
