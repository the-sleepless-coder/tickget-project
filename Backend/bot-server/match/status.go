package match

// MatchStatus 매치 상태
type MatchStatus int

const (
	StatusPending   MatchStatus = iota // 대기 중
	StatusScheduled                    // 스케줄됨
	StatusRunning                      // 실행 중
	StatusCompleted                    // 완료
	StatusCanceled                     // 취소됨
	StatusFailed                       // 실패
)

// String 상태를 문자열로 반환
func (s MatchStatus) String() string {
	switch s {
	case StatusPending:
		return "pending"
	case StatusScheduled:
		return "scheduled"
	case StatusRunning:
		return "running"
	case StatusCompleted:
		return "completed"
	case StatusCanceled:
		return "canceled"
	case StatusFailed:
		return "failed"
	default:
		return "unknown"
	}
}
