package client

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// APIError API 호출 실패 시 반환되는 에러
type APIError struct {
	StatusCode int
	Message    string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("API error (status %d): %s", e.StatusCode, e.Message)
}

// NewAPIError 새로운 API 에러를 생성
func NewAPIError(statusCode int, message string) *APIError {
	return &APIError{
		StatusCode: statusCode,
		Message:    message,
	}
}

// ParseStatusCode 에러에서 HTTP 상태 코드를 추출
// 상태 코드를 찾을 수 없으면 0을 반환
func ParseStatusCode(err error) int {
	if err == nil {
		return 0
	}

	// APIError 타입인 경우
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		return apiErr.StatusCode
	}

	// 에러 메시지 파싱: "API error (status 409): ..." 형식
	errMsg := err.Error()

	// "status " 뒤의 숫자 추출
	if idx := strings.Index(errMsg, "status "); idx != -1 {
		// "status " 이후 3자리 숫자 추출
		start := idx + 7
		if start+3 <= len(errMsg) {
			if code, err := strconv.Atoi(errMsg[start : start+3]); err == nil {
				return code
			}
		}
	}

	return 0
}

// 에러가 특정 HTTP 상태 코드인지 확인
func IsStatusCode(err error, statusCode int) bool {
	return ParseStatusCode(err) == statusCode
}

// 에러가 4xx 클라이언트 에러인지 확인
func IsClientError(err error) bool {
	code := ParseStatusCode(err)
	return code >= 400 && code < 500
}

// 에러가 5xx 서버 에러인지 확인
func IsServerError(err error) bool {
	code := ParseStatusCode(err)
	return code >= 500 && code < 600
}
