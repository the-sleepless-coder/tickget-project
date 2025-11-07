package logger

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var globalLogger *zap.Logger

// 글로벌 로거를 초기화
func Init(isDevelopment bool) error {
	var config zap.Config

	if isDevelopment {
		// 개발 환경: 사람이 읽기 편한 포맷, DEBUG 레벨
		config = zap.NewDevelopmentConfig()
		config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	} else {
		// 프로덕션 환경: JSON 포맷, INFO 레벨
		config = zap.NewProductionConfig()
		config.EncoderConfig.TimeKey = "timestamp"
		config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	}

	logger, err := config.Build(
		zap.AddCaller(),                       // 호출 위치 추가
		zap.AddStacktrace(zapcore.ErrorLevel), // ERROR 레벨에서 스택 트레이스
	)
	if err != nil {
		return err
	}

	globalLogger = logger
	return nil
}

// 글로벌 로거를 반환
func Get() *zap.Logger {
	if globalLogger == nil {
		// 초기화되지 않았으면 기본 로거 생성
		globalLogger = zap.NewExample()
	}
	return globalLogger
}

// 로거 플러시 (프로그램 종료 전 호출)
func Sync() {
	if globalLogger != nil {
		globalLogger.Sync()
	}
}

// 매치 컨텍스트를 포함한 로거를 반환
func WithMatchContext(matchID int64) *zap.Logger {
	return Get().With(
		zap.Int64("match_id", matchID),
	)
}

// 봇 컨텍스트를 포함한 로거를 반환
func WithBotContext(matchID int64, botID int) *zap.Logger {
	return Get().With(
		zap.Int64("match_id", matchID),
		zap.Int("bot_id", botID),
	)
}

// 정보 레벨 로그
func Info(msg string, fields ...zap.Field) {
	Get().Info(msg, fields...)
}

// 디버그 레벨 로그
func Debug(msg string, fields ...zap.Field) {
	Get().Debug(msg, fields...)
}

// 경고 레벨 로그
func Warn(msg string, fields ...zap.Field) {
	Get().Warn(msg, fields...)
}

// 에러 레벨 로그
func Error(msg string, fields ...zap.Field) {
	Get().Error(msg, fields...)
}

// 치명적 에러 로그 (프로그램 종료)
func Fatal(msg string, fields ...zap.Field) {
	Get().Fatal(msg, fields...)
}

// 환경변수에서 로그 레벨을 가져옴
func GetLogLevel() zapcore.Level {
	levelStr := os.Getenv("LOG_LEVEL")

	var level zapcore.Level
	if err := level.UnmarshalText([]byte(levelStr)); err != nil {
		return zapcore.InfoLevel // 기본값
	}

	return level
}
