package api

import (
	"encoding/json"
	"net/http"

	"bot-server/logger"
)

// Handler HTTP 요청 핸들러
type Handler struct {
	// 나중에 manager 등을 추가할 예정
}

// NewHandler 새로운 핸들러 인스턴스를 생성합니다
func NewHandler() *Handler {
	return &Handler{}
}

// RegisterRoutes 라우트를 등록합니다
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/health", h.HealthCheck)
	mux.HandleFunc("/ping", h.Ping)
}

// HealthCheck 서버 상태 확인 엔드포인트
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	response := map[string]string{
		"status":  "healthy",
		"service": "bot-server",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)

	logger.Debug("Health check requested")
}

// Ping 간단한 ping 엔드포인트
func (h *Handler) Ping(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "pong"})
}
