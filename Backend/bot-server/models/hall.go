package models

// 공연장 좌석 정보
type HallLayout struct {
	HallID   string    `json:"hallId"`   // 공연장 ID
	Sections []Section `json:"sections"` // 섹션 목록
}

// 섹션 정보
type Section struct {
	SectionID   string `json:"sectionId"`   // 섹션 ID (숫자 문자열: "1", "2", "3" 등)
	TotalRows   int    `json:"totalRows"`   // 총 행 수 (1부터 시작)
	TotalCols   int    `json:"totalCols"`   // 총 열 수 (1부터 시작)
	Unavailable []int  `json:"unavailable"` // 선택 불가능한 좌석 번호들
}

// 좌석 정보 (내부 사용)
type Seat struct {
	SectionID  string
	SeatNumber int // 좌석 번호: (행번호-1)*총열수 + 열번호
}

// 좌석 번호를 행/열로 변환
func (s Seat) ToRowCol(totalCols int) (row int, col int) {
	row = (s.SeatNumber-1)/totalCols + 1
	col = (s.SeatNumber-1)%totalCols + 1
	return
}

// 행/열을 좌석 번호로 변환
func SeatNumberFromRowCol(row, col, totalCols int) int {
	return (row-1)*totalCols + col
}

// API 요청용 좌석 ID 형태로 변환: "섹션ID-행번호-열번호"
func (s Seat) ToRequestFormat(totalCols int) string {
	row, col := s.ToRowCol(totalCols)
	return s.SectionID + "-" + string(rune('0'+row)) + "-" + string(rune('0'+col))
}
