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
	}

	logger.Info("설정 로드됨",
		zap.String("port", config.ServerPort),
		zap.String("ticketing_api", config.TicketingAPIURL),
		zap.Int("max_bots", config.MaxConcurrentBots),
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
