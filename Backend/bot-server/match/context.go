package match

import (
	"context"
	"sync"
	"time"

	"bot-server/bot"
	"bot-server/models"
)

// 매치별 실행 컨텍스트
type MatchContext struct {
	MatchID    int64
	BotCount   int
	StartTime  time.Time
	Difficulty models.Difficulty
	HallLayout *models.HallLayout // 공연장 좌석 정보
	BotLevels  []bot.Level        // 각 봇의 레벨 (난이도에 따라 생성됨)
	Status     MatchStatus

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	mu sync.RWMutex
}

// 새로운 매치 컨텍스트를 생성
func NewMatchContext(matchID int64, botCount int, startTime time.Time, difficulty models.Difficulty, hallLayout *models.HallLayout) *MatchContext {
	ctx, cancel := context.WithCancel(context.Background())

	return &MatchContext{
		MatchID:    matchID,
		BotCount:   botCount,
		StartTime:  startTime,
		Difficulty: difficulty,
		HallLayout: hallLayout,
		BotLevels:  bot.GenerateLevels(difficulty, botCount), // 난이도에 따라 봇 레벨 생성
		Status:     StatusPending,
		ctx:        ctx,
		cancel:     cancel,
	}
}

// 컨텍스트를 반환
func (mc *MatchContext) Context() context.Context {
	return mc.ctx
}

// 매치를 취소
func (mc *MatchContext) Cancel() {
	mc.cancel()
}

// 모든 봇이 완료될 때까지 대기
func (mc *MatchContext) Wait() {
	mc.wg.Wait()
}

// 봇을 추가
func (mc *MatchContext) AddBot() {
	mc.wg.Add(1)
}

// 봇 완료를 알림
func (mc *MatchContext) DoneBot() {
	mc.wg.Done()
}

// 매치 상태를 변경
func (mc *MatchContext) SetStatus(status MatchStatus) {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	mc.Status = status
}

// 매치 상태를 반환
func (mc *MatchContext) GetStatus() MatchStatus {
	mc.mu.RLock()
	defer mc.mu.RUnlock()
	return mc.Status
}
