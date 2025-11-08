package client

// 클라이언트가 제공하는 응답

//===공연 날짜/회차 선택 응답===
type DaySelectResponse struct {
	EventId        string `json:"eventId"`
	MatchId        int64  `json:"matchId"`
	PlayerType     string `json:"playerType"`
	Status         string `json:"status"`
	PositionAhead  int    `json:"positionAhead"`
	PositionBehind int    `json:"positionBehind"`
	TotalNum       int    `json:"totalNum"`
}

//===섹션 내 좌석 상태 응답 ===
type SectionStatusResponse struct {
	SectionId string `json:"sectionId"`
	Grade     Grade  `json:"grade"`
	Seats     []Seat `json:"seats"`
}

type Seat struct {
	SeatId string     `json:"seatId"`
	Status SeatStatus `json:"status"`
}

type Grade string

const (
	SeatGradeR        Grade = "R"
	SeatGradeS        Grade = "S"
	SeatGradeStanding Grade = "STANDING"
	SeatGradeVIP      Grade = "VIP"
)

type SeatStatus string

const (
	SeatStatusMyReserved SeatStatus = "MY_RESERVED"
	SeatStatusTaken      SeatStatus = "TAKEN"
	SeatStatusAvailable  SeatStatus = "AVAILABLE"
)

//===좌석 선택 응답===
type SeatSelectResponse struct {
	Success     bool         `json:"success"`
	HeldSeats   []SeatDetail `json:"heldSeats"`
	FailedSeats []SeatDetail `json:"failedSeats"`
}

type SeatDetail struct {
	SectionId int64  `json:"sectionId"`
	SeatId    string `json:"seatId"`
	Grade     Grade  `json:"grade"`
	MatchId   int64  `json:"matchId"`
}

//===좌석 확정 응답===
type SeatConfirmResponse struct {
	Success        bool              `json:"success"`
	Message        string            `json:"message"`
	UserRank       int               `json:"userRank"`
	ConfirmedSeats []ConfirmedSeat   `json:"confirmedSeats"`
	MatchId        string            `json:"matchId"`
	UserId         string            `json:"userId"`
}

type ConfirmedSeat struct {
	SeatId    string `json:"seatId"`
	SectionId string `json:"sectionId"`
}
