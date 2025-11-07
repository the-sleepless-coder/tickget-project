package bot

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"go.uber.org/zap"
)

// 티케팅 봇
type Bot struct {
	ID          int
	MatchID     int64
	Level       Level       // 봇 레벨 (초보/중수/고수)
	DelayConfig DelayConfig // 딜레이 설정
	logger      *zap.Logger
	startTime   time.Time
}

// 새로운 봇을 생성
func NewBot(id int, matchID int64, level Level, logger *zap.Logger) *Bot {
	return &Bot{
		ID:          id,
		MatchID:     matchID,
		Level:       level,
		DelayConfig: level.GetDelayConfig(),
		logger:      logger,
	}
}

// 봇을 실행(Mock 버전)
func (b *Bot) Run(ctx context.Context) error {
	b.startTime = time.Now()

	b.logger.Debug("봇 시작됨",
		zap.Int("bot_id", b.ID),
		zap.Int64("match_id", b.MatchID),
		zap.String("level", b.Level.String()),
	)

	// 단계 1: 요일 선택 (Mock)
	if err := b.selectDay(ctx); err != nil {
		return err
	}

	// 단계 2: 보안문자 입력 (Mock)
	if err := b.solveCaptcha(ctx); err != nil {
		return err
	}

	// 단계 3: 좌석 선택 (Mock)
	if err := b.selectSeat(ctx); err != nil {
		return err
	}

	duration := time.Since(b.startTime)
	b.logger.Info("봇 성공적으로 완료됨",
		zap.Int("bot_id", b.ID),
		zap.Int64("match_id", b.MatchID),
		zap.Duration("duration", duration),
	)

	return nil
}

// 요일 선택 (Mock)
func (b *Bot) selectDay(ctx context.Context) error {
	delay := b.DelayConfig.RandomDelay(b.DelayConfig.SelectDayBase, b.DelayConfig.SelectDayVariance)

	//무조건 현재 +3일
	select {
	case <-time.After(delay):
		b.logger.Debug("요일 선택됨",
			zap.Int("bot_id", b.ID),
			zap.Duration("delay", delay),
		)
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// 보안문자 입력 (Mock)
func (b *Bot) solveCaptcha(ctx context.Context) error {
	delay := b.DelayConfig.RandomDelay(b.DelayConfig.CaptchaBase, b.DelayConfig.CaptchaVariance)

	select {
	case <-time.After(delay):
		b.logger.Debug("보안문자 통과",
			zap.Int("bot_id", b.ID),
			zap.Duration("delay", delay),
		)
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// 좌석 선택 (Mock)
func (b *Bot) selectSeat(ctx context.Context) error {
	delay := b.DelayConfig.RandomDelay(b.DelayConfig.SelectSeatBase, b.DelayConfig.SelectSeatVariance)

	select {
	case <-time.After(delay):
		// 90% 성공 확률
		if rand.Float32() > 0.1 {
			b.logger.Debug("좌석 선택 성공",
				zap.Int("bot_id", b.ID),
				zap.Duration("delay", delay),
			)
			return nil
		}
		// 10% 실패
		return fmt.Errorf("좌석이 이미 선점됨")
	case <-ctx.Done():
		return ctx.Err()
	}
}
