package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"bot-server/logger"

	"go.uber.org/zap"
)

// Ticketing API와 통신하는 HTTP 클라이언트
type HTTPClient struct {
	baseURL    string
	httpClient *http.Client
}

// 새로운 HTTP 클라이언트를 생성
func NewHTTPClient(baseURL string) *HTTPClient {
	return &HTTPClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 100,
				IdleConnTimeout:     90 * time.Second,
			},
		},
	}
}

// JoinQueue 공연 날짜/회차 선택 (큐에 넣기) API 호출
func (c *HTTPClient) JoinQueue(ctx context.Context, matchId int64) (*DaySelectResponse, error) {
	endpoint := fmt.Sprintf("/ticketing/queue/%d", matchId)
	var resp DaySelectResponse
	if err := c.get(ctx, endpoint, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// GetSectionStatus 섹션 내 좌석 상태 조회 API 호출
func (c *HTTPClient) GetSectionStatus(ctx context.Context, matchId int64, sectionId string) (*SectionStatusResponse, error) {
	endpoint := fmt.Sprintf("/ticketing/matches/%d/sections/%s/seats/status", matchId, sectionId)
	var resp SectionStatusResponse
	if err := c.get(ctx, endpoint, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// HoldSeats 좌석 선택 (선점) API 호출
func (c *HTTPClient) HoldSeats(ctx context.Context, matchId int64, req *SeatSelectRequest) (*SeatSelectResponse, error) {
	endpoint := fmt.Sprintf("/ticketing/matches/%d/hold", matchId)
	var resp SeatSelectResponse
	if err := c.post(ctx, endpoint, req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ConfirmSeats 좌석 확정 API 호출
func (c *HTTPClient) ConfirmSeats(ctx context.Context, matchId int64, req *SeatConfirmRequest) (*SeatConfirmResponse, error) {
	endpoint := fmt.Sprintf("/ticketing/matches/%d/seats/confirm", matchId)
	var resp SeatConfirmResponse
	if err := c.post(ctx, endpoint, req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// GET 요청을 보내는 공통 메서드
func (c *HTTPClient) get(ctx context.Context, endpoint string, respBody interface{}) error {
	url := c.baseURL + endpoint
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		logger.Error("HTTP 요청 생성 실패", zap.Error(err))
		return fmt.Errorf("failed to create request: %w", err)
	}
	return c.doRequest(httpReq, respBody)
}

// POST 요청을 보내는 공통 메서드
func (c *HTTPClient) post(ctx context.Context, endpoint string, reqBody, respBody interface{}) error {
	url := c.baseURL + endpoint

	// 요청 본문을 JSON으로 변환
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		logger.Error("JSON 마샬링 실패", zap.Error(err))
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		logger.Error("HTTP 요청 생성 실패", zap.Error(err))
		return fmt.Errorf("failed to create request: %w", err)
	}
	return c.doRequest(httpReq, respBody)
}

// doRequest HTTP 요청을 실행하고 응답을 처리하는 공통 메서드
func (c *HTTPClient) doRequest(httpReq *http.Request, respBody interface{}) error {
	httpReq.Header.Set("Content-Type", "application/json")

	// 요청 전송
	logger.Debug("HTTP 요청 전송",
		zap.String("url", httpReq.URL.String()),
		zap.String("method", httpReq.Method),
	)

	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		logger.Error("HTTP 요청 실패", zap.Error(err), zap.String("url", httpReq.URL.String()))
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer httpResp.Body.Close()

	// 응답 본문 읽기
	body, err := io.ReadAll(httpResp.Body)
	if err != nil {
		logger.Error("응답 본문 읽기 실패", zap.Error(err))
		return fmt.Errorf("failed to read response body: %w", err)
	}

	// 상태 코드 확인
	if httpResp.StatusCode < 200 || httpResp.StatusCode >= 300 {
		logger.Error("HTTP 요청 실패",
			zap.Int("status_code", httpResp.StatusCode),
			zap.String("response", string(body)),
		)
		return NewAPIError(httpResp.StatusCode, string(body))
	}

	// 응답 JSON 파싱
	if len(body) > 0 {
		if err := json.Unmarshal(body, respBody); err != nil {
			logger.Error("JSON 언마샬링 실패",
				zap.Error(err),
				zap.String("response", string(body)),
			)
			return fmt.Errorf("failed to unmarshal response: %w", err)
		}
	}

	logger.Debug("HTTP 요청 성공",
		zap.String("url", httpReq.URL.String()),
		zap.Int("status_code", httpResp.StatusCode),
	)

	return nil
}

// Close HTTP 클라이언트 리소스를 정리
func (c *HTTPClient) Close() {
	c.httpClient.CloseIdleConnections()
}
