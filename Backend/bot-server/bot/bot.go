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
	TargetSeats []Seat      // 목표 좌석 목록 (우선순위순)
	logger      *zap.Logger
	startTime   time.Time
}

// Seat는 좌석 정보 (순환 import 방지)
type Seat struct {
	SectionID  string
	SeatNumber int // 좌석 번호: (행-1)*총열수 + 열
	TotalCols  int // 섹션의 총 열 수 (행/열 변환에 필요)
}

// 새로운 봇을 생성
func NewBot(id int, matchID int64, level Level, logger *zap.Logger) *Bot {
	return &Bot{
		ID:          -id,
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

// 좌석 선택 (목표 좌석 순서대로 재시도)
func (b *Bot) selectSeat(ctx context.Context) error {
	if len(b.TargetSeats) == 0 {
		return fmt.Errorf("할당된 목표 좌석이 없습니다")
	}

	// 목표 좌석 순서대로 시도
	for i, seat := range b.TargetSeats {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// 기본 딜레이
		delay := b.DelayConfig.RandomDelay(b.DelayConfig.SelectSeatBase, b.DelayConfig.SelectSeatVariance)
		time.Sleep(delay)

		// TODO: 실제 API 호출로 좌석 선점 시도
		// success, err := b.tryReserveSeat(seat)

		// Mock: 90% 성공 확률
		success := rand.Float32() > 0.1

		// 행/열 계산 (로깅용)
		row := (seat.SeatNumber-1)/seat.TotalCols + 1
		col := (seat.SeatNumber-1)%seat.TotalCols + 1

		if success {
			b.logger.Info("좌석 선택 성공",
				zap.Int("bot_id", b.ID),
				zap.Int("attempt", i+1),
				zap.String("section", seat.SectionID),
				zap.Int("seat_number", seat.SeatNumber),
				zap.Int("row", row),
				zap.Int("col", col),
				zap.Duration("delay", delay),
			)
			return nil
		}

		// 실패 시 로그
		b.logger.Debug("좌석 선점 실패, 다음 후보로 재시도",
			zap.Int("bot_id", b.ID),
			zap.Int("attempt", i+1),
			zap.String("section", seat.SectionID),
			zap.Int("seat_number", seat.SeatNumber),
			zap.Int("row", row),
			zap.Int("col", col),
		)

		// 마지막 시도가 아니면 재시도 딜레이
		if i < len(b.TargetSeats)-1 {
			retryDelay := b.Level.GetRetryDelay()
			time.Sleep(retryDelay)
		}
	}

	return fmt.Errorf("모든 목표 좌석(%d개) 선점 실패", len(b.TargetSeats))
}
