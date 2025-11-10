package models

// Difficulty 티케팅 난이도
type Difficulty string

const (
	DifficultyEasy   Difficulty = "EASY"   // 초보 봇 비율 높음
	DifficultyMedium Difficulty = "MEDIUM" // 중수 봇 비율 높음
	DifficultyHard   Difficulty = "HARD"   // 고수 봇 비율 높음
)

// IsValid 유효한 난이도인지 확인
func (d Difficulty) IsValid() bool {
	switch d {
	case DifficultyEasy, DifficultyMedium, DifficultyHard:
		return true
	default:
		return false
	}
}
