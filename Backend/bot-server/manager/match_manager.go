package manager

import (
	"fmt"
	"sync"

	"bot-server/bot"
	"bot-server/logger"
	"bot-server/match"
	"bot-server/models"
	"bot-server/scheduler"

	"go.uber.org/zap"
)

// MatchManager 매치 관리자
type MatchManager struct {
	matches       map[string]*match.MatchContext
	scheduler     *scheduler.Scheduler
	maxBots       int // 최대
	availableBots int // 현재 가용 가능 봇 수
	mu            sync.RWMutex
}

// NewMatchManager 새로운 매치 매니저를 생성합니다
func NewMatchManager(maxBots int) *MatchManager {
	return &MatchManager{
		matches:       make(map[string]*match.MatchContext),
		scheduler:     scheduler.NewScheduler(logger.Get()),
		maxBots:       maxBots,
		availableBots: maxBots,
	}
}

func (m *MatchManager) GetBotCount() (total int, available int) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.maxBots, m.availableBots
}

// StartMatch 매치를 시작합니다
func (m *MatchManager) StartMatch(req models.MatchStartRequest) error {
	matchLogger := logger.WithMatchContext(req.MatchID)

	// 매치 컨텍스트 생성
	matchCtx := match.NewMatchContext(req.MatchID, req.BotCount, req.StartTime)

	// 매치 등록
	m.mu.Lock()
	if _, exists := m.matches[req.MatchID]; exists {
		m.mu.Unlock()
		return fmt.Errorf("match %s already exists", req.MatchID)
	}
	m.matches[req.MatchID] = matchCtx
	m.mu.Unlock()

	matchLogger.Info("Match registered",
		zap.Int("bot_count", req.BotCount),
		zap.Time("start_time", req.StartTime),
	)

	// 별도 goroutine에서 스케줄링 및 실행
	go func() {
		defer m.cleanupMatch(req.MatchID)

		matchCtx.SetStatus(match.StatusScheduled)

		// 시간까지 대기 후 실행
		err := m.scheduler.ScheduleAt(matchCtx.Context(), req.StartTime, func() error {
			return m.runMatch(matchCtx)
		})

		if err != nil {
			matchLogger.Error("Match failed", zap.Error(err))
			matchCtx.SetStatus(match.StatusFailed)
			return
		}

		matchCtx.SetStatus(match.StatusCompleted)
		matchLogger.Info("Match completed successfully")
	}()

	return nil
}

// runMatch 매치를 실행합니다
func (m *MatchManager) runMatch(matchCtx *match.MatchContext) error {
	matchLogger := logger.WithMatchContext(matchCtx.MatchID)
	matchCtx.SetStatus(match.StatusRunning)

	matchLogger.Info("Starting bots",
		zap.Int("count", matchCtx.BotCount),
	)

	// N개의 봇을 goroutine으로 실행
	for i := 0; i < matchCtx.BotCount; i++ {
		matchCtx.AddBot()

		go func(botID int) {
			defer matchCtx.DoneBot()

			botLogger := logger.WithBotContext(matchCtx.MatchID, botID)
			b := bot.NewBot(botID, matchCtx.MatchID, botLogger)

			if err := b.Run(matchCtx.Context()); err != nil {
				botLogger.Warn("Bot failed", zap.Error(err))
			}
		}(i)
	}

	// 모든 봇 완료 대기
	matchCtx.Wait()

	matchLogger.Info("All bots completed")
	return nil
}

// cleanupMatch 매치를 정리합니다
func (m *MatchManager) cleanupMatch(matchID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.matches, matchID)
}

// GetMatch 매치 정보를 반환합니다
func (m *MatchManager) GetMatch(matchID string) (*match.MatchContext, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	matchCtx, exists := m.matches[matchID]
	return matchCtx, exists
}
