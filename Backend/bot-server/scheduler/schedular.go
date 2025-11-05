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
	now := time.Now()
	delay := startTime.Sub(now)

	if delay < 0 {
		s.logger.Warn("Start time is in the past, executing immediately",
			zap.Time("start_time", startTime),
			zap.Time("now", now),
		)
		return fn()
	}

	s.logger.Info("Match scheduled",
		zap.Time("start_time", startTime),
		zap.Duration("delay", delay),
	)

	select {
	case <-time.After(delay):
		s.logger.Info("Starting match now")
		return fn()
	case <-ctx.Done():
		s.logger.Info("Match schedule canceled")
		return ctx.Err()
	}
}
