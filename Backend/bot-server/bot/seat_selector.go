package bot

import (
	"math"
	"math/rand"
	"sort"
	"strconv"

	"bot-server/models"
)

// 좌석 선택기
type SeatSelector struct {
	hallLayout *models.HallLayout
	rng        *rand.Rand
}

// 새로운 좌석 선택기를 생성
func NewSeatSelector(hallLayout *models.HallLayout, seed int64) *SeatSelector {
	return &SeatSelector{
		hallLayout: hallLayout,
		rng:        rand.New(rand.NewSource(seed)),
	}
}

// 선택 가능한 좌석 목록을 생성 (선택 불가능한 좌석 제외)
func (ss *SeatSelector) GetAvailableSeats() []Seat {
	var availableSeats []Seat

	for _, section := range ss.hallLayout.Sections {
		// 섹션의 불가능한 좌석을 맵으로 변환 (빠른 조회)
		unavailableMap := make(map[int]bool)
		for _, seatNum := range section.Seats {
			unavailableMap[seatNum] = true
		}

		// 모든 좌석 순회하며 선택 가능한 좌석만 추가
		totalSeats := section.TotalRows * section.TotalCols
		for seatNum := 1; seatNum <= totalSeats; seatNum++ {
			// 선택 불가능한 좌석이 아니면 추가
			if !unavailableMap[seatNum] {
				availableSeats = append(availableSeats, Seat{
					SectionID:  section.SectionID,
					SeatNumber: seatNum,
					Grade:      section.Grade, // 섹션의 Grade 정보 추가
				})
			}
		}
	}

	return availableSeats
}

// 섹션 ID를 숫자로 파싱 (파싱 실패 시 최대값 반환)
func parseSectionNumber(sectionID string) int {
	num, err := strconv.Atoi(sectionID)
	if err != nil {
		// 파싱 실패 시 매우 큰 값 반환 (낮은 우선순위)
		return 999
	}
	return num
}

// 좌석에 점수를 부여 (레벨별 선호도 반영)
func (ss *SeatSelector) ScoreSeat(seat Seat, level Level) float64 {
	// 해당 좌석의 섹션 정보 찾기
	var section *models.Section
	for i := range ss.hallLayout.Sections {
		if ss.hallLayout.Sections[i].SectionID == seat.SectionID {
			section = &ss.hallLayout.Sections[i]
			break
		}
	}

	if section == nil {
		return 0
	}

	score := 0.0

	// 좌석 번호에서 행/열 계산
	row := (seat.SeatNumber-1)/section.TotalCols + 1
	col := (seat.SeatNumber-1)%section.TotalCols + 1

	// 1순위: 섹션 번호 (가장 중요 - 1000점 만점)
	totalSections := len(ss.hallLayout.Sections)
	sectionNum := parseSectionNumber(section.SectionID)

	// 섹션 순위를 퍼센티지로 변환 (1등 = 1000점, 꼴등 = 0점)
	var sectionScore float64
	if totalSections > 1 {
		sectionScore = 1000.0 * (1.0 - float64(sectionNum-1)/float64(totalSections-1))
	} else {
		sectionScore = 1000.0 // 섹션이 1개면 만점
	}

	// 고수는 섹션 점수 가중치가 더 높음
	if level == LevelPro {
		score += sectionScore * 1.5
	} else if level == LevelExpert {
		score += sectionScore * 1.0
	} else {
		score += sectionScore * 0.5 // 초보는 섹션에 덜 민감
	}

	// 2순위: 행 번호 (앞자리 선호 - 100점 만점)
	// 앞쪽 행일수록 높은 점수
	rowScore := 100.0 * (1.0 - float64(row-1)/float64(section.TotalRows))

	// 고수는 앞자리 더 선호
	if level == LevelPro {
		rowScore *= 1.2
	}

	score += rowScore

	// 3순위: 열 위치 (중앙 선호 - 50점 만점)
	middleCol := float64(section.TotalCols) / 2.0
	colDistance := math.Abs(float64(col) - middleCol)
	colScore := 50.0 * (1.0 - colDistance/middleCol)
	score += colScore

	return score
}

// 봇들에게 목표 좌석 할당 (단순 순환 방식)
func AssignTargetSeats(bots []*Bot, hallLayout *models.HallLayout) {
	// 좌석 선택기 생성
	selector := NewSeatSelector(hallLayout, 12345)

	// 선택 가능한 좌석 목록 생성
	availableSeats := selector.GetAvailableSeats()

	// 점수 계산 및 정렬 (레벨 구분 없이 통일된 점수)
	type seatScore struct {
		Seat  Seat
		Score float64
	}
	seatScores := make([]seatScore, 0, len(availableSeats))

	for _, seat := range availableSeats {
		// 기본 점수 계산 (레벨 관계없이 LevelPro 기준으로 통일)
		score := selector.ScoreSeat(seat, LevelPro)
		seatScores = append(seatScores, seatScore{
			Seat:  seat,
			Score: score,
		})
	}

	// 점수 높은 순으로 정렬
	sort.Slice(seatScores, func(i, j int) bool {
		return seatScores[i].Score > seatScores[j].Score
	})

	// 정렬된 좌석 배열 추출
	sortedSeats := make([]Seat, len(seatScores))
	for i, ss := range seatScores {
		sortedSeats[i] = ss.Seat
	}

	totalSeats := len(sortedSeats)

	// 섹션별 TotalCols 정보
	sectionInfo := make(map[string]int)
	for _, section := range hallLayout.Sections {
		sectionInfo[section.SectionID] = section.TotalCols
	}

	// 각 봇에게 3개씩 순환 할당
	const seatsPerBot = 3

	for i, bot := range bots {
		targetSeats := make([]Seat, 0, seatsPerBot)

		// 좌석이 있는 경우에만 할당
		if totalSeats > 0 {
			for j := 0; j < seatsPerBot; j++ {
				seatIndex := (i + j) % totalSeats
				seat := sortedSeats[seatIndex]
				seat.TotalCols = sectionInfo[seat.SectionID]
				targetSeats = append(targetSeats, seat)
			}
		}

		bot.TargetSeats = targetSeats
	}
}
