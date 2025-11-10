package bot

import (
	"bot-server/models"
	"math/rand"
)

// 난이도별 봇 레벨 분포
type Distribution struct {
	Beginner int // 초보 비율 (%)
	Expert   int // 중수 비율 (%)
	Pro      int // 고수 비율 (%)
}

// 난이도에 따른 봇 레벨 분포 반환
func GetDistribution(difficulty models.Difficulty) Distribution {
	switch difficulty {
	case models.DifficultyEasy:
		return Distribution{
			Beginner: 70, // 70% 초보
			Expert:   20, // 20% 중수
			Pro:      10, // 10% 고수
		}
	case models.DifficultyMedium:
		return Distribution{
			Beginner: 30, // 30% 초보
			Expert:   50, // 50% 중수
			Pro:      20, // 20% 고수
		}
	case models.DifficultyHard:
		return Distribution{
			Beginner: 10, // 10% 초보
			Expert:   30, // 30% 중수
			Pro:      60, // 60% 고수
		}
	default:
		// 기본값은 Medium
		return GetDistribution(models.DifficultyMedium)
	}
}

// 난이도와 봇 개수에 따라 봇 레벨 배열 생성
func GenerateLevels(difficulty models.Difficulty, count int) []Level {
	dist := GetDistribution(difficulty)
	levels := make([]Level, count)

	// 비율에 따라 각 레벨 봇 수 계산
	beginnerCount := (count * dist.Beginner) / 100
	expertCount := (count * dist.Expert) / 100
	proCount := count - beginnerCount - expertCount // 나머지는 고수

	// 레벨 할당
	idx := 0
	for i := 0; i < beginnerCount; i++ {
		levels[idx] = LevelBeginner
		idx++
	}
	for i := 0; i < expertCount; i++ {
		levels[idx] = LevelExpert
		idx++
	}
	for i := 0; i < proCount; i++ {
		levels[idx] = LevelPro
		idx++
	}

	// 셔플 (랜덤하게 섞기)
	rand.Shuffle(len(levels), func(i, j int) {
		levels[i], levels[j] = levels[j], levels[i]
	})

	return levels
}

// min ~ max 범위의 랜덤 정수 반환
func randomInt(min, max int) int {
	if min == max {
		return min
	}
	if min > max {
		min, max = max, min
	}
	return min + rand.Intn(max-min+1)
}
