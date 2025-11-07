package bot

import "time"

// Level 봇의 숙련도 레벨
type Level int

const (
	LevelBeginner Level = iota // 초보
	LevelExpert                 // 중수
	LevelPro                    // 고수
)

// String Level을 문자열로 변환
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

// GetDelayConfig 레벨에 따른 딜레이 설정 반환
func (l Level) GetDelayConfig() DelayConfig {
	switch l {
	case LevelBeginner:
		return DelayConfig{
			SelectDayBase:     3000, // 3초
			SelectDayVariance: 300,  // ±0.3초
			CaptchaBase:       5000, // 5초
			CaptchaVariance:   500,  // ±0.5초
			SelectSeatBase:    2000, // 2초
			SelectSeatVariance: 300, // ±0.3초
		}
	case LevelExpert:
		return DelayConfig{
			SelectDayBase:     2000, // 2초
			SelectDayVariance: 200,  // ±0.2초
			CaptchaBase:       3000, // 3초
			CaptchaVariance:   300,  // ±0.3초
			SelectSeatBase:    1500, // 1.5초
			SelectSeatVariance: 200, // ±0.2초
		}
	case LevelPro:
		return DelayConfig{
			SelectDayBase:     1000, // 1초
			SelectDayVariance: 100,  // ±0.1초
			CaptchaBase:       1500, // 1.5초
			CaptchaVariance:   150,  // ±0.15초
			SelectSeatBase:    800,  // 0.8초
			SelectSeatVariance: 100, // ±0.1초
		}
	default:
		return LevelBeginner.GetDelayConfig()
	}
}

// DelayConfig 딜레이 설정 (밀리초 단위)
type DelayConfig struct {
	SelectDayBase      int // 요일 선택 기본 딜레이
	SelectDayVariance  int // 요일 선택 변동폭
	CaptchaBase        int // 캡차 풀이 기본 딜레이
	CaptchaVariance    int // 캡차 풀이 변동폭
	SelectSeatBase     int // 좌석 선택 기본 딜레이
	SelectSeatVariance int // 좌석 선택 변동폭
}

// RandomDelay 랜덤 딜레이를 Duration으로 반환 (base ± variance)
func (dc DelayConfig) RandomDelay(base, variance int) time.Duration {
	// base - variance ~ base + variance 범위의 랜덤값
	delay := base + randomInt(-variance, variance)
	return time.Duration(delay) * time.Millisecond
}
