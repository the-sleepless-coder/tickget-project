package match

import (
	"context"
	"fmt"
	"sync"
	"time"

	"bot-server/bot"
	"bot-server/client"
	"bot-server/logger"
	"bot-server/models"
	"bot-server/scheduler"

	"go.uber.org/zap"
)

// 매치 서비스
type Service struct {
	matches     map[int64]*MatchContext
	scheduler   *scheduler.Scheduler
	botService  *bot.Service          // 봇 리소스 관리 서비스
	minioClient MinioClient           // Minio 클라이언트 인터페이스
	httpClient  *client.HTTPClient    // HTTP 클라이언트
	mu          sync.RWMutex
}

// MinioClient 인터페이스
type MinioClient interface {
	GetHallLayout(ctx context.Context, hallID string) (*models.HallLayout, error)
}

// 새로운 매치 서비스를 생성
func NewService(botService *bot.Service, minioClient MinioClient, httpClient *client.HTTPClient) *Service {
	return &Service{
		matches:     make(map[int64]*MatchContext),
		scheduler:   scheduler.NewScheduler(logger.Get()),
		botService:  botService,
		minioClient: minioClient,
		httpClient:  httpClient,
	}
}

// 매치 및 봇 세팅 시작
func (s *Service) SetBotsForMatch(matchID int64, req models.MatchSettingRequest) error {
	matchLogger := logger.WithMatchContext(matchID)

	// 0. 시작 시간 검증 (현재 시간 + 30초 이전 거부)
	minStartTime := time.Now().Add(30 * time.Second)
	if req.StartTime.Before(minStartTime) {
		return fmt.Errorf("시작 시간은 현재 시간으로부터 최소 30초 이후여야 합니다")
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

	s.mu.Unlock()

	// 3. 공연장 좌석 정보 로드
	ctx := context.Background()
	hallLayout, err := s.minioClient.GetHallLayout(ctx, req.HallID)
	if err != nil {
		s.botService.Release(req.BotCount) // 할당했던 봇 복구
		return fmt.Errorf("공연장 정보 로드 실패: %w", err)
	}

	// 4. 매치 컨텍스트 생성
	matchCtx := NewMatchContext(matchID, req.BotCount, req.StartTime, req.Difficulty, hallLayout)

	s.mu.Lock()
	s.matches[matchID] = matchCtx
	s.mu.Unlock()

	matchLogger.Info("매치 등록됨",
		zap.Int("bot_count", req.BotCount),
		zap.Time("start_time", req.StartTime),
		zap.String("difficulty", string(req.Difficulty)),
		zap.String("hall_id", req.HallID),
		zap.Int("sections", len(hallLayout.Sections)),
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

// 매치 실행
func (s *Service) runMatch(matchCtx *MatchContext) error {
	matchLogger := logger.WithMatchContext(matchCtx.MatchID)
	matchCtx.SetStatus(StatusRunning)

	matchLogger.Info("봇 시작 중",
		zap.Int("count", matchCtx.BotCount),
	)

	// 1. 봇 인스턴스 생성
	bots := make([]*bot.Bot, matchCtx.BotCount)
	for i := 0; i < matchCtx.BotCount; i++ {
		botLogger := logger.WithBotContext(matchCtx.MatchID, i)
		botLevel := matchCtx.BotLevels[i]
		bots[i] = bot.NewBot(i, matchCtx.MatchID, botLevel, s.httpClient, botLogger)
	}

	// 2. 봇들에게 목표 좌석 할당 (레벨별 우선순위)
	if matchCtx.HallLayout != nil {
		bot.AssignTargetSeats(bots, matchCtx.HallLayout)
		matchLogger.Info("봇들에게 목표 좌석 할당 완료",
			zap.Int("bot_count", len(bots)),
		)
	} else {
		matchLogger.Warn("공연장 정보가 없어 좌석 할당을 건너뜁니다")
	}

	// 3. 봇들을 goroutine으로 실행
	for i, b := range bots {
		matchCtx.AddBot()

		go func(botID int, botInstance *bot.Bot) {
			defer matchCtx.DoneBot()

			if err := botInstance.Run(matchCtx.Context()); err != nil {
				logger.WithBotContext(matchCtx.MatchID, botID).Warn("봇 실행 실패", zap.Error(err))
			}
		}(i, b)
	}

	// 모든 봇 완료 대기
	matchCtx.Wait()

	matchLogger.Info("모든 봇 완료됨")
	return nil
}

// 매치 정리
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

// 매치 정보를 반환
func (s *Service) GetMatch(matchID int64) (*MatchContext, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	matchCtx, exists := s.matches[matchID]
	return matchCtx, exists
}
