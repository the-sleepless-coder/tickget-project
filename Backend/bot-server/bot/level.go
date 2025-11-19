package bot

import "time"

// 봇의 숙련도 레벨
type Level int

const (
	LevelBeginner Level = iota // 초보
	LevelExpert                // 중수
	LevelPro                   // 고수
)

// Level을 문자열로 변환
func (l Level) String() string {
	switch l {
	case LevelBeginner:
		return "초보"
	case LevelExpert:
		return "중수"
	case LevelPro:
		return "고수"
	default:
		return "알수없음"
	}
}

// 레벨에 따른 딜레이 설정 반환
func (l Level) GetDelayConfig() DelayConfig {
	switch l {
	case LevelBeginner:
		return DelayConfig{
			SelectDayBase:      2000,  // 2.0초
			SelectDayVariance:  400,   // ±0.4초
			CaptchaBase:        15000, // 15초
			CaptchaVariance:    3000,  // ±3초
			SelectSeatBase:     5000,  // 5초
			SelectSeatVariance: 3000,  // ±2초
		}
	case LevelExpert:
		return DelayConfig{
			SelectDayBase:      1300,  // 1.3초
			SelectDayVariance:  300,   // ±0.3초
			CaptchaBase:        10000, // 10초
			CaptchaVariance:    2000,  // ±2초
			SelectSeatBase:     4000,  // 4초
			SelectSeatVariance: 1000,  // ±1초
		}
	case LevelPro:
		return DelayConfig{
			SelectDayBase:      800,  // 0.8초
			SelectDayVariance:  100,  // ±0.2초
			CaptchaBase:        6500, // 6.5초
			CaptchaVariance:    1500, // ±1.5초
			SelectSeatBase:     2500, // 2.5초
			SelectSeatVariance: 500,  // ±0.5초
		}
	default:
		return LevelBeginner.GetDelayConfig()
	}
}

//  딜레이 설정 (밀리초 단위)
type DelayConfig struct {
	SelectDayBase      int // 요일 선택 기본 딜레이
	SelectDayVariance  int // 요일 선택 변동폭
	CaptchaBase        int // 캡차 풀이 기본 딜레이
	CaptchaVariance    int // 캡차 풀이 변동폭
	SelectSeatBase     int // 좌석 선택 기본 딜레이
	SelectSeatVariance int // 좌석 선택 변동폭
}

// 랜덤 딜레이를 Duration으로 반환 (base ± variance)
func (dc DelayConfig) RandomDelay(base, variance int) time.Duration {
	// base - variance ~ base + variance 범위의 랜덤값
	delay := base + randomInt(-variance, variance)
	return time.Duration(delay) * time.Millisecond
}

// Jitter 범위 반환 (좌석 점수에 추가할 랜덤 변동폭)
func (l Level) GetJitterRange() float64 {
	switch l {
	case LevelPro:
		return 5.0 // 고수: 작은 변동 (일관된 선택)
	case LevelExpert:
		return 15.0 // 중수: 중간 변동
	case LevelBeginner:
		return 50.0 // 초보: 큰 변동 (랜덤에 가까움)
	default:
		return 50.0
	}
}

// 재시도 딜레이 반환
func (l Level) GetRetryDelay() time.Duration {
	switch l {
	case LevelPro:
		return 50 * time.Millisecond // 고수: 빠른 재시도
	case LevelExpert:
		return 100 * time.Millisecond // 중수: 중간
	case LevelBeginner:
		return 300 * time.Millisecond // 초보: 느린 재시도
	default:
		return 300 * time.Millisecond
	}
}

// 목표 좌석 후보 개수 반환
func (l Level) GetCandidateCount() int {
	switch l {
	case LevelPro:
		return 3 // 고수: 3개 (좋은 자리 집중)
	case LevelExpert:
		return 3 // 중수: 4개
	case LevelBeginner:
		return 4 // 초보: 5개 (더 넓게 분산)
	default:
		return 5
	}
}
