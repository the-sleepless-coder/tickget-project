package config

import (
	"log"
	"os"
	"strconv"

	"bot-server/logger"

	"github.com/joho/godotenv"
	"go.uber.org/zap"
)

// 애플리케이션 설정 구조체
type Config struct {
	ServerPort        string
	TicketingAPIURL   string
	StatsServerURL    string
	MaxConcurrentBots int
	MinioEndpoint     string
	MinioAccessKey    string
	MinioSecretKey    string
	MinioBucketName   string
	MinioUseSSL       bool
	KafkaBrokers      string // Kafka 브로커 주소 (쉼표로 구분)
	KafkaGroupID      string // Kafka Consumer Group ID
	KafkaTopic        string // Kafka Topic
}

// 환경변수에서 설정을 로드합니다
func Load() *Config {
	// .env 파일 로드 시도 (없어도 오류 무시)
	if err := godotenv.Load(); err != nil {
		log.Println(".env 파일이 없습니다. 환경 변수를 사용합니다")
	}

	config := &Config{
		ServerPort:        getEnv("SERVER_PORT", "8080"),
		TicketingAPIURL:   getEnv("TICKETING_API_URL", "http://localhost:3000"),
		StatsServerURL:    getEnv("STATS_SERVER_URL", "http://localhost:4000"),
		MaxConcurrentBots: getEnvAsInt("MAX_CONCURRENT_BOTS", 50000),
		MinioEndpoint:     getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinioAccessKey:    getEnv("MINIO_ACCESS_KEY", "minioadmin"),
		MinioSecretKey:    getEnv("MINIO_SECRET_KEY", "minioadmin"),
		MinioBucketName:   getEnv("MINIO_BUCKET_NAME", "venues"),
		MinioUseSSL:       getEnvAsBool("MINIO_USE_SSL", false),
		KafkaBrokers:      getEnv("KAFKA_BROKERS", "localhost:9092"),
		KafkaGroupID:      getEnv("KAFKA_GROUP_ID", "bot-server-group"),
		KafkaTopic:        getEnv("KAFKA_TOPIC", "bot-dequeued-publish"),
	}

	logger.Info("설정 로드됨",
		zap.String("port", config.ServerPort),
		zap.String("ticketing_api", config.TicketingAPIURL),
		zap.Int("max_bots", config.MaxConcurrentBots),
		zap.String("minio_endpoint", config.MinioEndpoint),
		zap.String("kafka_brokers", config.KafkaBrokers),
		zap.String("kafka_topic", config.KafkaTopic),
	)
	return config
}

// 환경변수 값을 가져오고, 없으면 기본값을 반환
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// 환경변수 값을 정수로 가져오고, 없으면 기본값을 반환
func getEnvAsInt(key string, defaultValue int) int {
	valueStr := os.Getenv(key)
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}

// 환경변수 값을 bool로 가져오고, 없으면 기본값을 반환
func getEnvAsBool(key string, defaultValue bool) bool {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}
	value, err := strconv.ParseBool(valueStr)
	if err != nil {
		return defaultValue
	}
	return value
}
