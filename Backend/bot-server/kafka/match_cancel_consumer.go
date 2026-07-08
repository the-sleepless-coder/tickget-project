package kafka

import (
	"context"
	"encoding/json"
	"fmt"

	"bot-server/logger"

	"github.com/IBM/sarama"
	"go.uber.org/zap"
)

// MatchBotCancelledEvent ticketing-server 가 발행하는 봇 취소(teardown) 이벤트
type MatchBotCancelledEvent struct {
	MatchID int64 `json:"matchId"`
}

// MatchCancelService 봇 취소를 처리하는 서비스 인터페이스
type MatchCancelService interface {
	CancelMatch(matchID int64) error
}

// MatchCancelConsumer match.bot.cancelled 토픽 컨슈머
type MatchCancelConsumer struct {
	consumer     sarama.ConsumerGroup
	topic        string
	matchService MatchCancelService
	logger       *zap.Logger
}

// NewMatchCancelConsumer MatchCancelConsumer 생성
func NewMatchCancelConsumer(brokers []string, groupID string, topic string, matchService MatchCancelService) (*MatchCancelConsumer, error) {
	config := sarama.NewConfig()
	config.Consumer.Return.Errors = true
	config.Consumer.Offsets.Initial = sarama.OffsetNewest

	consumer, err := sarama.NewConsumerGroup(brokers, groupID, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create match cancel consumer group: %w", err)
	}

	return &MatchCancelConsumer{
		consumer:     consumer,
		topic:        topic,
		matchService: matchService,
		logger:       logger.Get(),
	}, nil
}

// Start 컨슈머 시작
func (c *MatchCancelConsumer) Start(ctx context.Context) error {
	c.logger.Info("Match Cancel Kafka Consumer 시작", zap.String("topic", c.topic))

	handler := &matchCancelConsumerHandler{
		matchService: c.matchService,
		logger:       c.logger,
	}

	for {
		select {
		case <-ctx.Done():
			c.logger.Info("Match Cancel Kafka Consumer 종료 중")
			return c.consumer.Close()
		default:
			if err := c.consumer.Consume(ctx, []string{c.topic}, handler); err != nil {
				c.logger.Error("Match Cancel Consumer 에러", zap.Error(err))
				return err
			}
		}
	}
}

type matchCancelConsumerHandler struct {
	matchService MatchCancelService
	logger       *zap.Logger
}

func (h *matchCancelConsumerHandler) Setup(sarama.ConsumerGroupSession) error   { return nil }
func (h *matchCancelConsumerHandler) Cleanup(sarama.ConsumerGroupSession) error { return nil }

func (h *matchCancelConsumerHandler) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for message := range claim.Messages() {
		var event MatchBotCancelledEvent
		if err := json.Unmarshal(message.Value, &event); err != nil {
			h.logger.Error("취소 이벤트 파싱 실패", zap.Error(err), zap.String("message", string(message.Value)))
			session.MarkMessage(message, "")
			continue
		}

		h.logger.Info("봇 취소 요청 수신", zap.Int64("matchId", event.MatchID))

		// 멱등 처리: 대상 매치가 없으면 no-op 이므로 실패 로그만 남기고 커밋
		if err := h.matchService.CancelMatch(event.MatchID); err != nil {
			h.logger.Warn("봇 취소 처리 실패",
				zap.Int64("matchId", event.MatchID),
				zap.Error(err),
			)
		}

		session.MarkMessage(message, "")
	}
	return nil
}