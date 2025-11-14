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
	matches      map[int64]*MatchContext
	scheduler    *scheduler.Scheduler
	botService   *bot.Service       // 봇 리소스 관리 서비스
	minioClient  MinioClient        // Minio 클라이언트 인터페이스
	httpClient   *client.HTTPClient // HTTP 클라이언트
	waitChannels sync.Map           // map[string]chan struct{} - "matchID:userID" 형식의 키로 개별 봇 대기 채널 관리
	mu           sync.RWMutex
}

// MinioClient 인터페이스
type MinioClient interface {
	GetHallLayout(ctx context.Context, hallID int64) (*models.HallLayout, error)
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
	if req.BotCount == 0 {
		return nil
	}

	// 0. 시작 시간 검증 (현재 시간 + 10초 이전 거부)
	minStartTime := time.Now().Add(10 * time.Second)
	if req.StartTime.Before(minStartTime) {
		return fmt.Errorf("시작 시간은 현재 시간으로부터 최소 10초 이후여야 합니다")
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
	matchCtx := NewMatchContext(matchID, req.BotCount, req.StartTime.Time, req.Difficulty, hallLayout)

	s.mu.Lock()
	s.matches[matchID] = matchCtx
	s.mu.Unlock()

	matchLogger.Info("매치 등록됨",
		zap.Int("bot_count", req.BotCount),
		zap.Time("start_time", req.StartTime.Time),
		zap.String("difficulty", string(req.Difficulty)),
		zap.Int64("hall_id", req.HallID),
		zap.Int("sections", len(hallLayout.Sections)),
	)

	// 별도 goroutine에서 스케줄링 및 실행
	go func() {
		defer s.cleanupMatch(matchID)

		matchCtx.SetStatus(StatusScheduled)

		// 시간까지 대기 후 실행
		err := s.scheduler.ScheduleAt(matchCtx.Context(), req.StartTime.Time, func() error {
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

// 매치 실행 - 매치가 시작 시간에 도달했을 때 모든 봇 생성 및 시작
func (s *Service) runMatch(matchCtx *MatchContext) error {
	matchLogger := logger.WithMatchContext(matchCtx.MatchID)
	matchCtx.SetStatus(StatusRunning)

	matchLogger.Info("봇 시작 중",
		zap.Int("count", matchCtx.BotCount),
	)

	// 1. 봇 인스턴스 생성 (각 봇은 -1, -2, -3, ... 형식의 음수 userId 사용)
	bots := make([]*bot.Bot, matchCtx.BotCount)
	for i := 0; i < matchCtx.BotCount; i++ {
		userID := int64(-(i + 1)) // -1, -2, -3, ...
		botLogger := logger.Get().With(
			zap.Int64("match_id", matchCtx.MatchID),
			zap.Int64("user_id", userID),
		)
		botLevel := matchCtx.BotLevels[i]

		// 개별 봇용 대기 채널 생성 및 저장
		waitChannel := make(chan struct{})
		channelKey := getBotWaitChannelKey(matchCtx.MatchID, userID)
		s.waitChannels.Store(channelKey, waitChannel)

		bots[i] = bot.NewBot(userID, matchCtx.MatchID, botLevel, s.httpClient, waitChannel, botLogger)
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

	// 3. 봇들을 goroutine으로 실행 (JoinQueue 호출 후 대기 상태로 진입)
	for _, b := range bots {
		matchCtx.AddBot()

		go func(botInstance *bot.Bot) {
			defer matchCtx.DoneBot()
			defer func() {
				// 봇 완료 시 채널 정리
				channelKey := getBotWaitChannelKey(matchCtx.MatchID, botInstance.UserID)
				s.waitChannels.Delete(channelKey)
			}()

			if err := botInstance.Run(matchCtx.Context()); err != nil {
				logger.Get().With(
					zap.Int64("match_id", matchCtx.MatchID),
					zap.Int64("user_id", botInstance.UserID),
				).Warn("봇 실행 실패", zap.Error(err))
			}
		}(b)
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

// getBotWaitChannelKey matchID와 userID를 조합한 대기 채널 키 생성
func getBotWaitChannelKey(matchID int64, userID int64) string {
	return fmt.Sprintf("%d:%d", matchID, userID)
}

// SignalBotStart Kafka 이벤트로 개별 봇의 대기를 해제
func (s *Service) SignalBotStart(matchID int64, userID int64) {
	matchLogger := logger.WithMatchContext(matchID)

	// 개별 봇의 대기 채널 찾기
	channelKey := getBotWaitChannelKey(matchID, userID)
	chInterface, ok := s.waitChannels.Load(channelKey)

	if !ok {
		matchLogger.Warn("대기 중인 봇을 찾을 수 없습니다", zap.Int64("user_id", userID))
		return
	}

	ch := chInterface.(chan struct{})

	matchLogger.Info("개별 봇 시작 신호 전송",
		zap.Int64("user_id", userID),
	)

	// 해당 봇의 채널을 닫아서 대기 해제
	close(ch)
}
