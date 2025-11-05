package match

import (
	"context"
	"sync"
	"time"
)

// MatchContext 매치별 실행 컨텍스트
type MatchContext struct {
	MatchID   string
	BotCount  int
	StartTime time.Time
	Status    MatchStatus

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	mu sync.RWMutex
}

// NewMatchContext 새로운 매치 컨텍스트를 생성합니다
func NewMatchContext(matchID string, botCount int, startTime time.Time) *MatchContext {
	ctx, cancel := context.WithCancel(context.Background())

	return &MatchContext{
		MatchID:   matchID,
		BotCount:  botCount,
		StartTime: startTime,
		Status:    StatusPending,
		ctx:       ctx,
		cancel:    cancel,
	}
}

// Context 컨텍스트를 반환합니다
func (mc *MatchContext) Context() context.Context {
	return mc.ctx
}

// Cancel 매치를 취소합니다
func (mc *MatchContext) Cancel() {
	mc.cancel()
}

// Wait 모든 봇이 완료될 때까지 대기합니다
func (mc *MatchContext) Wait() {
	mc.wg.Wait()
}

// AddBot 봇을 추가합니다
func (mc *MatchContext) AddBot() {
	mc.wg.Add(1)
}

// DoneBot 봇 완료를 알립니다
func (mc *MatchContext) DoneBot() {
	mc.wg.Done()
}

// SetStatus 매치 상태를 변경합니다
func (mc *MatchContext) SetStatus(status MatchStatus) {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	mc.Status = status
}

// GetStatus 매치 상태를 반환합니다
func (mc *MatchContext) GetStatus() MatchStatus {
	mc.mu.RLock()
	defer mc.mu.RUnlock()
	return mc.Status
}
