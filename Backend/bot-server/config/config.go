package config

import (
	"log"
	"os"
	"strconv"

	"bot-server/logger"

	"github.com/joho/godotenv"
	"go.uber.org/zap"
)

// Config 애플리케이션 설정 구조체
type Config struct {
	ServerPort        string
	TicketingAPIURL   string
	StatsServerURL    string
	MaxConcurrentBots int
}

// Load 환경변수에서 설정을 로드합니다
func Load() *Config {
	// .env 파일 로드 시도 (없어도 오류 무시)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	config := &Config{
		ServerPort:        getEnv("SERVER_PORT", "8080"),
		TicketingAPIURL:   getEnv("TICKETING_API_URL", "http://localhost:3000"),
		StatsServerURL:    getEnv("STATS_SERVER_URL", "http://localhost:4000"),
		MaxConcurrentBots: getEnvAsInt("MAX_CONCURRENT_BOTS", 50000),
	}

	logger.Info("Config loaded",
		zap.String("port", config.ServerPort),
		zap.String("ticketing_api", config.TicketingAPIURL),
		zap.Int("max_bots", config.MaxConcurrentBots),
	)
	return config
}

// getEnv 환경변수 값을 가져오고, 없으면 기본값을 반환
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvAsInt 환경변수 값을 정수로 가져오고, 없으면 기본값을 반환
func getEnvAsInt(key string, defaultValue int) int {
	valueStr := os.Getenv(key)
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}
