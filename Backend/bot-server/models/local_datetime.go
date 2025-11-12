package models

import (
	"encoding/json"
	"fmt"
	"time"
)

// LocalDateTime Java의 LocalDateTime을 한국 시간(Asia/Seoul)으로 파싱하는 커스텀 타입
type LocalDateTime struct {
	time.Time
}

// UnmarshalJSON 타임존 정보 없는 시간을 Asia/Seoul로 해석
func (ldt *LocalDateTime) UnmarshalJSON(data []byte) error {
	// null 체크
	if string(data) == "null" || string(data) == `""` {
		return nil
	}

	// JSON 문자열에서 따옴표 제거
	str := string(data)
	if len(str) < 2 {
		return fmt.Errorf("invalid datetime string: %s", str)
	}
	str = str[1 : len(str)-1]

	// 한국 타임존 로드
	location, err := time.LoadLocation("Asia/Seoul")
	if err != nil {
		return fmt.Errorf("failed to load Asia/Seoul timezone: %w", err)
	}

	// 여러 LocalDateTime 형식 시도
	formats := []string{
		"2006-01-02T15:04:05.999999999", // ISO 형식 + 나노초
		"2006-01-02T15:04:05.999999",    // ISO 형식 + 마이크로초
		"2006-01-02T15:04:05.999",       // ISO 형식 + 밀리초
		"2006-01-02T15:04:05",           // ISO 형식
		"2006-01-02 15:04:05.999999999", // 공백 구분 + 나노초
		"2006-01-02 15:04:05.999999",    // 공백 구분 + 마이크로초
		"2006-01-02 15:04:05.999",       // 공백 구분 + 밀리초
		"2006-01-02 15:04:05",           // 공백 구분
	}

	var t time.Time
	for _, format := range formats {
		t, err = time.ParseInLocation(format, str, location)
		if err == nil {
			ldt.Time = t
			return nil
		}
	}

	return fmt.Errorf("failed to parse datetime %s with any known format: %w", str, err)
}

// MarshalJSON LocalDateTime 형식으로 직렬화
func (ldt LocalDateTime) MarshalJSON() ([]byte, error) {
	if ldt.Time.IsZero() {
		return []byte("null"), nil
	}
	return json.Marshal(ldt.Format("2006-01-02T15:04:05"))
}
