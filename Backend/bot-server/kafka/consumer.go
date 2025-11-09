package kafka

import (
	"context"
	"encoding/json"
	"fmt"

	"bot-server/logger"

	"github.com/IBM/sarama"

	"go.uber.org/zap"
)

// MatchStartEvent Kafka에서 수신하는 매치 시작 이벤트
type MatchStartEvent struct {
	MatchID int64  `json:"matchId"`
	EventID string `json:"eventId"`
}

// MatchService 인터페이스 (순환 import 방지)
type MatchService interface {
	SignalMatchStart(matchID int64)
}

// Consumer Kafka Consumer
type Consumer struct {
	consumer     sarama.ConsumerGroup
	topic        string
	matchService MatchService
	logger       *zap.Logger
}

// NewConsumer Kafka Consumer 생성
func NewConsumer(brokers []string, groupID string, topic string, matchService MatchService) (*Consumer, error) {
	config := sarama.NewConfig()
	config.Consumer.Return.Errors = true
	config.Consumer.Offsets.Initial = sarama.OffsetNewest

	consumer, err := sarama.NewConsumerGroup(brokers, groupID, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create consumer group: %w", err)
	}

	return &Consumer{
		consumer:     consumer,
		topic:        topic,
		matchService: matchService,
		logger:       logger.Get(),
	}, nil
}

// Start Kafka Consumer 시작
func (c *Consumer) Start(ctx context.Context) error {
	c.logger.Info("Kafka Consumer 시작",
		zap.String("topic", c.topic),
	)

	handler := &consumerGroupHandler{
		matchService: c.matchService,
		logger:       c.logger,
	}

	for {
		select {
		case <-ctx.Done():
			c.logger.Info("Kafka Consumer 종료 중")
			return c.consumer.Close()
		default:
			if err := c.consumer.Consume(ctx, []string{c.topic}, handler); err != nil {
				c.logger.Error("Kafka Consumer 에러", zap.Error(err))
				return err
			}
		}
	}
}

// consumerGroupHandler Kafka Consumer Group Handler
type consumerGroupHandler struct {
	matchService MatchService
	logger       *zap.Logger
}

func (h *consumerGroupHandler) Setup(sarama.ConsumerGroupSession) error {
	return nil
}

func (h *consumerGroupHandler) Cleanup(sarama.ConsumerGroupSession) error {
	return nil
}

func (h *consumerGroupHandler) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for message := range claim.Messages() {
		h.logger.Debug("Kafka 메시지 수신",
			zap.String("topic", message.Topic),
			zap.Int32("partition", message.Partition),
			zap.Int64("offset", message.Offset),
		)

		// 이벤트 파싱
		var event MatchStartEvent
		if err := json.Unmarshal(message.Value, &event); err != nil {
			h.logger.Error("이벤트 파싱 실패", zap.Error(err), zap.String("message", string(message.Value)))
			session.MarkMessage(message, "")
			continue
		}

		h.logger.Info("매치 시작 이벤트 수신",
			zap.Int64("match_id", event.MatchID),
			zap.String("event_id", event.EventID),
		)

		// 매치 서비스에 신호 전달
		h.matchService.SignalMatchStart(event.MatchID)

		// 오프셋 커밋
		session.MarkMessage(message, "")
	}

	return nil
}
