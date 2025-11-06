package scheduler

import (
	"context"
	"time"

	"go.uber.org/zap"
)

// Scheduler 스케줄러
type Scheduler struct {
	logger *zap.Logger
}

// NewScheduler 새로운 스케줄러를 생성합니다
func NewScheduler(logger *zap.Logger) *Scheduler {
	return &Scheduler{
		logger: logger,
	}
}

// ScheduleAt 지정된 시간에 함수를 실행합니다
func (s *Scheduler) ScheduleAt(ctx context.Context, startTime time.Time, fn func() error) error {
	delay := startTime.Sub(time.Now())

	s.logger.Info("매치 스케줄됨",
		zap.Time("start_time", startTime),
		zap.Duration("delay", delay),
	)

	select {
	case <-time.After(delay):
		s.logger.Info("매치를 지금 시작합니다")
		return fn()
	case <-ctx.Done():
		s.logger.Info("매치 스케줄이 취소되었습니다")
		return ctx.Err()
	}
}
