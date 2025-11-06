package manager

import (
	"fmt"
	"sync"
	"time"

	"bot-server/bot"
	"bot-server/logger"
	"bot-server/match"
	"bot-server/models"
	"bot-server/scheduler"

	"go.uber.org/zap"
)

// MatchManager 매치 관리자
type MatchManager struct {
	matches       map[int64]*match.MatchContext
	scheduler     *scheduler.Scheduler
	maxBots       int // 최대
	availableBots int // 현재 가용 가능 봇 수
	mu            sync.RWMutex
}

// NewMatchManager 새로운 매치 매니저를 생성
func NewMatchManager(maxBots int) *MatchManager {
	return &MatchManager{
		matches:       make(map[int64]*match.MatchContext),
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

// 매치 및 봇 세팅 시작
func (m *MatchManager) SetBotsForMatch(matchID int64, req models.MatchSettingRequest) error {
	matchLogger := logger.WithMatchContext(matchID)

	// 0. 시작 시간 검증 (과거 시간 거부)
	if req.StartTime.Before(time.Now()) {
		return fmt.Errorf("시작 시간은 현재 시간보다 이후여야 합니다")
	}

	// 매치 등록 + 가용 봇 체크 및 차감
	m.mu.Lock()

	// 1. 가용 봇 수 체크
	if m.availableBots < req.BotCount {
		m.mu.Unlock()
		return fmt.Errorf("가용 봇이 부족합니다 (요청: %d, 가용: %d)",
			req.BotCount, m.availableBots)
	}

	// 2. 중복 매치 체크
	if _, exists := m.matches[matchID]; exists {
		m.mu.Unlock()
		return fmt.Errorf("매치 %d가 이미 존재합니다", matchID)
	}

	// 3. 봇 할당 (차감)
	m.availableBots -= req.BotCount

	// 4. 매치 등록
	matchCtx := match.NewMatchContext(matchID, req.BotCount, req.StartTime)
	m.matches[matchID] = matchCtx

	m.mu.Unlock()

	matchLogger.Info("매치 등록됨",
		zap.Int("bot_count", req.BotCount),
		zap.Time("start_time", req.StartTime),
	)

	// 별도 goroutine에서 스케줄링 및 실행
	go func() {
		defer m.cleanupMatch(matchID)

		matchCtx.SetStatus(match.StatusScheduled)

		// 시간까지 대기 후 실행
		err := m.scheduler.ScheduleAt(matchCtx.Context(), req.StartTime, func() error {
			return m.runMatch(matchCtx)
		})

		if err != nil {
			matchLogger.Error("매치 실패", zap.Error(err))
			matchCtx.SetStatus(match.StatusFailed)
			return
		}

		matchCtx.SetStatus(match.StatusCompleted)
		matchLogger.Info("매치 성공적으로 완료됨")
	}()

	return nil
}

// runMatch 매치를 실행
func (m *MatchManager) runMatch(matchCtx *match.MatchContext) error {
	matchLogger := logger.WithMatchContext(matchCtx.MatchID)
	matchCtx.SetStatus(match.StatusRunning)

	matchLogger.Info("봇 시작 중",
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
				botLogger.Warn("봇 실행 실패", zap.Error(err))
			}
		}(i)
	}

	// 모든 봇 완료 대기
	matchCtx.Wait()

	matchLogger.Info("모든 봇 완료됨")
	return nil
}

// cleanupMatch 매치를 정리
func (m *MatchManager) cleanupMatch(matchID int64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// 매치 정보 가져오기
	if matchCtx, exists := m.matches[matchID]; exists {
		// 봇 해제 (복구)
		m.availableBots += matchCtx.BotCount

		// 매치 삭제
		delete(m.matches, matchID)
	}
}

// GetMatch 매치 정보를 반환
func (m *MatchManager) GetMatch(matchID int64) (*match.MatchContext, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	matchCtx, exists := m.matches[matchID]
	return matchCtx, exists
}
