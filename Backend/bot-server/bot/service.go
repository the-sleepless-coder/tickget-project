package bot

import (
	"fmt"
	"sync"
)

// 봇 리소스 풀 관리 서비스
type Service struct {
	maxBots       int // 최대 봇 수
	availableBots int // 현재 가용 가능한 봇 수
	mu            sync.RWMutex
}

// 새로운 봇 서비스를 생성
func NewService(maxBots int) *Service {
	return &Service{
		maxBots:       maxBots,
		availableBots: maxBots,
	}
}

// 전체 봇 수와 가용 봇 수를 반환
func (s *Service) GetCount() (total int, available int) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.maxBots, s.availableBots
}

// 봇 리소스를 할당 (차감)
func (s *Service) Acquire(count int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.availableBots < count {
		return fmt.Errorf("가용 봇이 부족합니다 (요청: %d, 가용: %d)",
			count, s.availableBots)
	}

	s.availableBots -= count
	return nil
}

// 봇 리소스를 반환 (복구)
func (s *Service) Release(count int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.availableBots += count
}
