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

// 봇들에게 목표 좌석 할당 (레벨별 우선순위)
func AssignTargetSeats(bots []*Bot, hallLayout *models.HallLayout) {
	// 좌석 선택기 생성
	selector := NewSeatSelector(hallLayout, 12345)

	// 선택 가능한 좌석 목록
	availableSeats := selector.GetAvailableSeats()

	// 고수 -> 중수 -> 초보 순으로 정렬 (고수가 먼저 좋은 자리 선택)
	sortedBots := make([]*Bot, len(bots))
	copy(sortedBots, bots)
	sort.Slice(sortedBots, func(i, j int) bool {
		return sortedBots[i].Level > sortedBots[j].Level
	})

	// 1순위 좌석만 중복 방지 (2순위부터는 겹쳐도 됨)
	firstChoiceSeats := make(map[string]bool)

	// 섹션별 TotalCols 정보를 빠르게 조회하기 위한 맵
	sectionInfo := make(map[string]int) // sectionID -> totalCols
	for _, section := range hallLayout.Sections {
		sectionInfo[section.SectionID] = section.TotalCols
	}

	for _, bot := range sortedBots {
		// 봇별 좌석 점수 계산
		type seatScore struct {
			Seat  Seat
			Score float64
		}
		seatScores := make([]seatScore, 0, len(availableSeats))

		for _, seat := range availableSeats {
			score := selector.ScoreSeat(seat, bot.Level)

			// 봇마다 약간의 랜덤 jitter 추가 (자연스러운 분산)
			jitter := selector.rng.Float64() * bot.Level.GetJitterRange()
			score += jitter

			seatScores = append(seatScores, seatScore{
				Seat:  seat,
				Score: score,
			})
		}

		// 점수순 정렬
		sort.Slice(seatScores, func(i, j int) bool {
			return seatScores[i].Score > seatScores[j].Score
		})

		// 레벨별 후보 개수 (고수: 3개, 중수: 4개, 초보: 5개)
		candidateCount := bot.Level.GetCandidateCount()

		// 상위 N개를 목표 좌석으로 할당
		targetSeats := make([]Seat, 0, candidateCount)

		for i := 0; i < candidateCount && len(targetSeats) < candidateCount; {
			if i >= len(seatScores) {
				break // 더 이상 사용 가능한 좌석 없음
			}

			seat := seatScores[i].Seat
			seatKey := seat.SectionID + "-" + string(rune('0'+seat.SeatNumber))

			// 1순위는 중복 체크, 2순위부터는 무조건 추가
			if len(targetSeats) == 0 {
				// 1순위: 다른 봇의 1순위와 겹치지 않아야 함
				if firstChoiceSeats[seatKey] {
					i++ // 다음 좌석으로
					continue
				}
				firstChoiceSeats[seatKey] = true
			}

			// TotalCols 정보 추가
			seat.TotalCols = sectionInfo[seat.SectionID]
			targetSeats = append(targetSeats, seat)
			i++
		}

		bot.TargetSeats = targetSeats
	}
}
