package match

import (
	"fmt"
	"sync"
	"time"

	"bot-server/bot"
	"bot-server/logger"
	"bot-server/models"
	"bot-server/scheduler"

	"go.uber.org/zap"
)

// Service 매치 서비스
type Service struct {
	matches    map[int64]*MatchContext
	scheduler  *scheduler.Scheduler
	botService *bot.Service // 봇 리소스 관리 서비스
	mu         sync.RWMutex
}

// NewService 새로운 매치 서비스를 생성
func NewService(botService *bot.Service) *Service {
	return &Service{
		matches:    make(map[int64]*MatchContext),
		scheduler:  scheduler.NewScheduler(logger.Get()),
		botService: botService,
	}
}

// SetBotsForMatch 매치 및 봇 세팅 시작
func (s *Service) SetBotsForMatch(matchID int64, req models.MatchSettingRequest) error {
	matchLogger := logger.WithMatchContext(matchID)

	// 0. 시작 시간 검증 (과거 시간 거부)
	if req.StartTime.Before(time.Now()) {
		return fmt.Errorf("시작 시간은 현재 시간보다 이후여야 합니다")
	}

	// 1. 봇 리소스 할당 (차감)
	if err := s.botService.Acquire(req.BotCount); err != nil {
		return err
	}

	// 매치 등록
	s.mu.Lock()

	// 2. 중복 매치 체크
	if _, exists := s.matches[matchID]; exists {
		s.mu.Unlock()
		s.botService.Release(req.BotCount) // 할당했던 봇 복구
		return fmt.Errorf("매치 %d가 이미 존재합니다", matchID)
	}

	// 3. 매치 등록
	matchCtx := NewMatchContext(matchID, req.BotCount, req.StartTime, req.Difficulty)
	s.matches[matchID] = matchCtx

	s.mu.Unlock()

	matchLogger.Info("매치 등록됨",
		zap.Int("bot_count", req.BotCount),
		zap.Time("start_time", req.StartTime),
		zap.String("difficulty", string(req.Difficulty)),
	)

	// 별도 goroutine에서 스케줄링 및 실행
	go func() {
		defer s.cleanupMatch(matchID)

		matchCtx.SetStatus(StatusScheduled)

		// 시간까지 대기 후 실행
		err := s.scheduler.ScheduleAt(matchCtx.Context(), req.StartTime, func() error {
			return s.runMatch(matchCtx)
		})

		if err != nil {
			matchLogger.Error("매치 실패", zap.Error(err))
			matchCtx.SetStatus(StatusFailed)
			return
		}

		matchCtx.SetStatus(StatusCompleted)
		matchLogger.Info("매치 성공적으로 완료됨")
	}()

	return nil
}

// runMatch 매치를 실행
func (s *Service) runMatch(matchCtx *MatchContext) error {
	matchLogger := logger.WithMatchContext(matchCtx.MatchID)
	matchCtx.SetStatus(StatusRunning)

	matchLogger.Info("봇 시작 중",
		zap.Int("count", matchCtx.BotCount),
	)

	// N개의 봇을 goroutine으로 실행
	for i := 0; i < matchCtx.BotCount; i++ {
		matchCtx.AddBot()

		go func(botID int) {
			defer matchCtx.DoneBot()

			botLogger := logger.WithBotContext(matchCtx.MatchID, botID)
			botLevel := matchCtx.BotLevels[botID] // 미리 생성된 레벨 사용
			b := bot.NewBot(botID, matchCtx.MatchID, botLevel, botLogger)

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
func (s *Service) cleanupMatch(matchID int64) {
	s.mu.Lock()
	matchCtx, exists := s.matches[matchID]
	if exists {
		delete(s.matches, matchID)
	}
	s.mu.Unlock()

	// 봇 리소스 반환
	if exists {
		s.botService.Release(matchCtx.BotCount)
	}
}

// GetMatch 매치 정보를 반환
func (s *Service) GetMatch(matchID int64) (*MatchContext, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	matchCtx, exists := s.matches[matchID]
	return matchCtx, exists
}
