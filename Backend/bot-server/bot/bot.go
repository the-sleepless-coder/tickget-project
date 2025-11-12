package bot

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"bot-server/client"

	"go.uber.org/zap"
)

// 티케팅 봇
type Bot struct {
	UserID      int64       // 사용자 ID (봇은 음수)
	MatchID     int64
	Level       Level       // 봇 레벨 (초보/중수/고수)
	DelayConfig DelayConfig // 딜레이 설정
	TargetSeats []Seat      // 목표 좌석 목록 (우선순위순)
	logger      *zap.Logger
	httpClient  *client.HTTPClient // HTTP 클라이언트
	waitChannel <-chan struct{}    // 매치 시작 대기 채널
	startTime   time.Time
}

// Seat는 좌석 정보 (순환 import 방지)
type Seat struct {
	SectionID  string
	SeatNumber int    // 좌석 번호: (행-1)*총열수 + 열
	TotalCols  int    // 섹션의 총 열 수 (행/열 변환에 필요)
	Grade      string // 좌석 등급 (VIP, R석, S석 등)
}

// 새로운 봇을 생성
func NewBot(userID int64, matchID int64, level Level, httpClient *client.HTTPClient, waitChannel <-chan struct{}, logger *zap.Logger) *Bot {
	return &Bot{
		UserID:      userID,
		MatchID:     matchID,
		Level:       level,
		DelayConfig: level.GetDelayConfig(),
		httpClient:  httpClient,
		waitChannel: waitChannel,
		logger:      logger,
	}
}

// 봇을 실행
func (b *Bot) Run(ctx context.Context) error {
	b.startTime = time.Now()

	b.logger.Debug("봇 시작됨",
		zap.Int64("user_id", b.UserID),
		zap.Int64("match_id", b.MatchID),
		zap.String("level", b.Level.String()),
	)

	// 단계 1: 요일 선택 - JoinQueue 호출
	if err := b.selectDay(ctx); err != nil {
		return err
	}

	// 단계 1.5: 큐에서 매치 시작 신호 대기
	b.logger.Debug("매치 시작 신호 대기 중",
		zap.Int64("user_id", b.UserID),
	)

	select {
	case <-b.waitChannel:
		b.logger.Debug("매치 시작 신호 수신",
			zap.Int64("user_id", b.UserID),
		)
	case <-ctx.Done():
		return ctx.Err()
	}

	// 단계 2: 보안문자 입력
	if err := b.solveCaptcha(ctx); err != nil {
		return err
	}

	// 단계 3: 좌석 선택
	if err := b.selectSeat(ctx); err != nil {
		return err
	}

	// 단계 4: 좌석 확정
	if err := b.confirmSeats(ctx); err != nil {
		return err
	}

	duration := time.Since(b.startTime)
	b.logger.Info("봇 성공적으로 완료됨",
		zap.Int64("user_id", b.UserID),
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
		// delay를 밀리초로 변환
		durationMs := int(delay.Milliseconds())

		// 요청 생성
		req := &client.DaySelectRequest{
			ClickMiss: 0,
			Duration:  durationMs,
		}

		_, err := b.httpClient.JoinQueue(ctx, b.MatchID, req, b.UserID)
		if err != nil {
			return fmt.Errorf("요일 선택 실패: %w", err)
		}

		b.logger.Debug("요일 선택됨",
			zap.Int64("user_id", b.UserID),
			zap.Duration("delay", delay),
			zap.Int("duration_ms", durationMs),
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
		// 요청 생성
		req := &client.ValidateCaptchaRequest{
			UserId: b.UserID,
		}

		err := b.httpClient.ValidateCaptcha(ctx, req)
		if err != nil {
			return fmt.Errorf("캡챠 검증 실패: %w", err)
		}

		b.logger.Debug("보안문자 통과",
			zap.Int64("user_id", b.UserID),
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

		// 행/열 계산
		row := (seat.SeatNumber-1)/seat.TotalCols + 1
		col := (seat.SeatNumber-1)%seat.TotalCols + 1

		// SectionID를 int64로 변환
		sectionIdNum, err := strconv.ParseInt(seat.SectionID, 10, 64)
		if err != nil {
			b.logger.Error("섹션ID 변환 실패",
				zap.Int64("user_id", b.UserID),
				zap.String("section_id", seat.SectionID),
				zap.Error(err),
			)
			continue
		}

		// SeatInfo 생성
		seatInfo := client.SeatInfo{
			SectionId: sectionIdNum,
			Row:       int64(row),
			Col:       int64(col),
			Grade:     seat.Grade,
		}

		// 실제 API 호출로 좌석 선점 시도
		req := &client.SeatSelectRequest{
			UserId:     b.UserID,
			Seats:      []client.SeatInfo{seatInfo},
			TotalSeats: 0, // 봇은 totalSeats 검증 제외
		}

		resp, err := b.httpClient.HoldSeats(ctx, b.MatchID, req)
		if err != nil {
			b.logger.Warn("좌석 선점 API 호출 실패",
				zap.Int64("user_id", b.UserID),
				zap.Int("attempt", i+1),
				zap.String("section", seat.SectionID),
				zap.Int("seat_number", seat.SeatNumber),
				zap.Int("row", row),
				zap.Int("col", col),
				zap.Error(err),
			)

			// API 호출 실패 시 다음 좌석으로 재시도
			if i < len(b.TargetSeats)-1 {
				retryDelay := b.Level.GetRetryDelay()
				time.Sleep(retryDelay)
			}
			continue
		}

		// 성공 여부 확인
		if resp.Success && len(resp.HeldSeats) > 0 {
			b.logger.Info("좌석 선택 성공",
				zap.Int64("user_id", b.UserID),
				zap.Int("attempt", i+1),
				zap.String("section", seat.SectionID),
				zap.Int("seat_number", seat.SeatNumber),
				zap.Int("row", row),
				zap.Int("col", col),
				zap.Duration("delay", delay),
				zap.Int("held_seats_count", len(resp.HeldSeats)),
			)
			return nil
		}

		// 실패 시 로그
		b.logger.Debug("좌석 선점 실패, 다음 후보로 재시도",
			zap.Int64("user_id", b.UserID),
			zap.Int("attempt", i+1),
			zap.String("section", seat.SectionID),
			zap.Int("seat_number", seat.SeatNumber),
			zap.Int("row", row),
			zap.Int("col", col),
			zap.Int("failed_seats_count", len(resp.FailedSeats)),
		)

		// 마지막 시도가 아니면 재시도 딜레이
		if i < len(b.TargetSeats)-1 {
			retryDelay := b.Level.GetRetryDelay()
			time.Sleep(retryDelay)
		}
	}

	return fmt.Errorf("모든 목표 좌석(%d개) 선점 실패", len(b.TargetSeats))
}

// 좌석 확정
func (b *Bot) confirmSeats(ctx context.Context) error {
	// 요청 생성 (userId만 실제 값, 나머지는 0)
	req := &client.SeatConfirmRequest{
		UserId:                   b.UserID,
		DateSelectTime:           0.0,
		SeccodeSelectTime:        0.0,
		SeccodeBackspaceCount:    0,
		SeccodeTryCount:          0,
		SeatSelectTime:           0.0,
		SeatSelectTryCount:       0,
		SeatSelectClickMissCount: 0,
	}

	resp, err := b.httpClient.ConfirmSeats(ctx, b.MatchID, req)
	if err != nil {
		b.logger.Error("좌석 확정 실패",
			zap.Int64("user_id", b.UserID),
			zap.Error(err),
		)
		return fmt.Errorf("좌석 확정 실패: %w", err)
	}

	b.logger.Info("좌석 확정 성공",
		zap.Int64("user_id", b.UserID),
		zap.Bool("success", resp.Success),
		zap.String("message", resp.Message),
		zap.Int("user_rank", resp.UserRank),
		zap.Int("confirmed_seats_count", len(resp.ConfirmedSeats)),
	)

	return nil
}
