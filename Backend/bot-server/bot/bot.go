package bot

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"go.uber.org/zap"
)

// Bot 티케팅 봇
type Bot struct {
	ID        int
	MatchID   string
	logger    *zap.Logger
	startTime time.Time
}

// NewBot 새로운 봇을 생성합니다
func NewBot(id int, matchID string, logger *zap.Logger) *Bot {
	return &Bot{
		ID:      id,
		MatchID: matchID,
		logger:  logger,
	}
}

// Run 봇을 실행합니다 (Mock 버전)
func (b *Bot) Run(ctx context.Context) error {
	b.startTime = time.Now()

	b.logger.Debug("Bot started",
		zap.Int("bot_id", b.ID),
		zap.String("match_id", b.MatchID),
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
	b.logger.Info("Bot completed successfully",
		zap.Int("bot_id", b.ID),
		zap.String("match_id", b.MatchID),
		zap.Duration("duration", duration),
	)

	return nil
}

// selectDay 요일 선택 (Mock)
func (b *Bot) selectDay(ctx context.Context) error {
	// 랜덤 딜레이 (50~200ms)
	delay := time.Duration(50+rand.Intn(150)) * time.Millisecond

	select {
	case <-time.After(delay):
		b.logger.Debug("Day selected",
			zap.Int("bot_id", b.ID),
			zap.Duration("delay", delay),
		)
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// solveCaptcha 보안문자 입력 (Mock)
func (b *Bot) solveCaptcha(ctx context.Context) error {
	// 랜덤 딜레이 (100~300ms)
	delay := time.Duration(100+rand.Intn(200)) * time.Millisecond

	select {
	case <-time.After(delay):
		b.logger.Debug("Captcha solved",
			zap.Int("bot_id", b.ID),
			zap.Duration("delay", delay),
		)
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// selectSeat 좌석 선택 (Mock)
func (b *Bot) selectSeat(ctx context.Context) error {
	// 랜덤 딜레이 (50~150ms)
	delay := time.Duration(50+rand.Intn(100)) * time.Millisecond

	select {
	case <-time.After(delay):
		// 90% 성공 확률
		if rand.Float32() > 0.1 {
			b.logger.Debug("Seat selected successfully",
				zap.Int("bot_id", b.ID),
				zap.Duration("delay", delay),
			)
			return nil
		}
		// 10% 실패
		return fmt.Errorf("seat already taken")
	case <-ctx.Done():
		return ctx.Err()
	}
}
