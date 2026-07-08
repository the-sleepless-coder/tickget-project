package kafka

import (
	"context"
	"encoding/json"
	"fmt"

	"bot-server/logger"
	"bot-server/models"

	"github.com/IBM/sarama"
	"go.uber.org/zap"
)

// MatchBotRequestedEvent ticketing-server outbox에서 발행하는 봇 세팅 요청 이벤트
type MatchBotRequestedEvent struct {
	MatchID    int64                `json:"matchId"`
	BotCount   int                  `json:"botCount"`
	StartTime  models.LocalDateTime `json:"startTime"`
	Difficulty string               `json:"difficulty"`
	HallID     int64                `json:"hallId"`
}

// MatchSetupService 봇 세팅을 처리하는 서비스 인터페이스
type MatchSetupService interface {
	SetBotsForMatch(matchID int64, req models.MatchSettingRequest) error
}

// MatchConsumer match.bot.requested 토픽 컨슈머
type MatchConsumer struct {
	consumer     sarama.ConsumerGroup
	topic        string
	matchService MatchSetupService
	logger       *zap.Logger
}

// NewMatchConsumer MatchConsumer 생성
func NewMatchConsumer(brokers []string, groupID string, topic string, matchService MatchSetupService) (*MatchConsumer, error) {
	config := sarama.NewConfig()
	config.Consumer.Return.Errors = true
	config.Consumer.Offsets.Initial = sarama.OffsetNewest

	consumer, err := sarama.NewConsumerGroup(brokers, groupID, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create match consumer group: %w", err)
	}

	return &MatchConsumer{
		consumer:     consumer,
		topic:        topic,
		matchService: matchService,
		logger:       logger.Get(),
	}, nil
}

// Start 컨슈머 시작
func (c *MatchConsumer) Start(ctx context.Context) error {
	c.logger.Info("Match Kafka Consumer 시작", zap.String("topic", c.topic))

	handler := &matchConsumerHandler{
		matchService: c.matchService,
		logger:       c.logger,
	}

	for {
		select {
		case <-ctx.Done():
			c.logger.Info("Match Kafka Consumer 종료 중")
			return c.consumer.Close()
		default:
			if err := c.consumer.Consume(ctx, []string{c.topic}, handler); err != nil {
				c.logger.Error("Match Consumer 에러", zap.Error(err))
				return err
			}
		}
	}
}

type matchConsumerHandler struct {
	matchService MatchSetupService
	logger       *zap.Logger
}

func (h *matchConsumerHandler) Setup(sarama.ConsumerGroupSession) error   { return nil }
func (h *matchConsumerHandler) Cleanup(sarama.ConsumerGroupSession) error { return nil }

func (h *matchConsumerHandler) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for message := range claim.Messages() {
		h.logger.Debug("Match 이벤트 수신",
			zap.String("topic", message.Topic),
			zap.Int64("offset", message.Offset),
		)

		var event MatchBotRequestedEvent
		if err := json.Unmarshal(message.Value, &event); err != nil {
			h.logger.Error("이벤트 파싱 실패", zap.Error(err), zap.String("message", string(message.Value)))
			session.MarkMessage(message, "")
			continue
		}

		h.logger.Info("봇 세팅 요청 수신", zap.Int64("matchId", event.MatchID), zap.Int("botCount", event.BotCount))

		req := models.MatchSettingRequest{
			BotCount:   event.BotCount,
			StartTime:  event.StartTime,
			Difficulty: models.Difficulty(event.Difficulty),
			HallID:     event.HallID,
		}

		if err := h.matchService.SetBotsForMatch(event.MatchID, req); err != nil {
			// 멱등성: "이미 존재합니다" 에러는 중복 메시지 — 정상 처리
			h.logger.Warn("봇 세팅 실패 또는 중복 메시지",
				zap.Int64("matchId", event.MatchID),
				zap.Error(err),
			)
		}

		session.MarkMessage(message, "")
	}
	return nil
}
