# CLAUDE.md — S13P31A209 (TickGet)

## Project Overview

티켓팅 연습 플랫폼. 실제 티켓팅과 유사한 환경(대기열, 좌석 선택, 결제, CAPTCHA)을 제공하고,
게임 방 기반으로 친구들과 경쟁하며 티켓팅 실력을 키울 수 있다.

---

## Architecture

이벤트 드리븐 마이크로서비스 구조. 서비스 간 통신은 Kafka(비동기)와 REST(동기)로 분리된다.

```
Frontend (React/Vite)
    ↕ REST / WebSocket (STOMP)
API Gateway (Traefik) — ForwardAuth → Auth Server
    ↕
┌─────────────┬──────────────┬─────────────┬────────────┐
│ room-server │ ticketing-   │ user-server │ search-    │
│ (WebSocket) │ server       │             │ server     │
└──────┬──────┴──────┬───────┴──────┬──────┴────────────┘
       │             │              │
       └─────────────┴──────────────┘
                     │ Kafka topics
              stats-server (consumer)
                     │
              AI/AI_analyst (FastAPI)
```

**인프라**: Docker → Kubernetes (Kustomize) → ArgoCD GitOps  
**CI/CD**: GitLab CI — 변경된 서비스만 빌드 후 Docker Hub 푸시, Kustomization 매니페스트 자동 업데이트

---

## Services

| 서비스 | 언어/프레임워크 | 역할 |
|--------|----------------|------|
| `Frontend` | React 19 / Vite / TypeScript | SPA 클라이언트 |
| `auth-server` | Java 21 / Spring Boot 3.5 | JWT 발급·검증, OAuth2 Google, Traefik ForwardAuth |
| `room-server` | Java 21 / Spring Boot 3.5 | 게임 방 관리, STOMP WebSocket 실시간 통신 |
| `ticketing-server` | Java 21 / Spring Boot 3.5 | 대기열, 좌석 선택·확정, 결제, CAPTCHA 연동 |
| `user-server` | Java 21 / Spring Boot 3.5 | 사용자 프로필, 예약 내역 |
| `search-server` | Java 21 / Spring Boot 3.5 | Elasticsearch 기반 공연·장소 검색 |
| `stats-server` | Java 21 / Spring Boot 3.5 | Kafka 소비 → 게임 통계 집계 |
| `bot-server` | Go | 티켓팅 봇 시뮬레이터 (초급/중급/고급) |
| `captcha-server` | Python / FastAPI | CAPTCHA 생성·검증 |
| `AI/AI_analyst` | Python / FastAPI | LLM 기반 사용자 퍼포먼스 분석 리포트 |
| `AI/seatmap_to_html` | Python / FastAPI | 좌석 이미지 → HTML 좌석맵 변환 (OpenCV) |

---

## Key Flows

### 인증 흐름
- Access Token (7일) — 응답 바디
- Refresh Token (30일) — HttpOnly Secure 쿠키
- 모든 요청은 Traefik ForwardAuth → `auth-server /validate` 통과
- 로그아웃 시 Access Token → Redis 블랙리스트 등록

### 티켓팅 흐름
```
대기열 입장 → CAPTCHA 검증 → 좌석 선택 (Redis lock) 
  → Kafka: match.seat.selected → 좌석 확정 
  → Kafka: match.seat.confirmed → 결제 → 완료
```

### 실시간 통신 (room-server)
- WebSocket 엔드포인트: `/ws/rooms`
- STOMP + SockJS 사용
- 브로드캐스트: `/topic/*`, 개인 메시지: `/user/*`
- STOMP CONNECT 헤더에서 사용자 ID 추출
- Kafka로 다른 서비스에 룸 이벤트 전파 (UserJoinedRoom, RoomPlayingStarted 등)

---

## Kafka Topics

| Topic | Partitions | 발행자 | 소비자 |
|-------|-----------|--------|--------|
| `match.seat.selected` | 3 | ticketing-server | ticketing-server |
| `match.seat.confirmed` | 3 | ticketing-server | ticketing-server, stats-server |
| 룸 이벤트 (join/leave/start/end 등) | - | room-server | stats-server |

Consumer group ID는 `{서비스명}-${POD_NAME}` 패턴으로 Pod별 격리.

---

## Data Storage

| 스토어 | 용도 |
|--------|------|
| MySQL | 트랜잭션 데이터 (유저, 룸, 예약) |
| MongoDB | 시계열·통계 데이터 |
| Elasticsearch | 공연·장소 풀텍스트 검색 |
| Redis | 세션(Refresh Token), 좌석 캐시, 분산 락, 블랙리스트 |
| MinIO (S3) | 프로필 이미지, 좌석 이미지, 봇 결과물 |

---

## Tech Stack

**Backend (JVM)**
- Java 21, Spring Boot 3.5.x, Gradle
- JJWT (JWT), Spring Security, Spring Data JPA
- Kafka (Spring Kafka), Redis (Lettuce), Resilience4j
- Log4j2 (ticketing/stats-server) — Logback 충돌로 Log4j2 사용. 나머지는 SLF4J + Logback

**Frontend**
- React 19, TypeScript 5.9, Vite 7
- Zustand (전역 상태), Tailwind CSS, Material UI
- STOMP (WebSocket 클라이언트)

**Python Services**
- FastAPI, Uvicorn, Pydantic
- OpenCV (seatmap 처리), httpx (외부 HTTP)

**Go**
- 봇 서버: 전략 패턴 기반 봇 레벨(초/중/고급), Zap 로깅

---

## Coding Conventions

### Java (Spring)
- Controller → Service → Repository 계층 준수
- `@Transactional` 경계는 Service 레이어
- DB 커넥션 풀: HikariCP max 5, idle 5min
- Redis 풀: max 10 active, min 2 idle
- Multipart 업로드 한도: 5MB

### Frontend (React/TypeScript)
- 기능 단위 디렉터리 구조 (auth, booking-site, home, room 등)
- Zustand store는 도메인별 분리
- REST는 fetch/axios, WebSocket은 STOMP 클라이언트

### Python
- FastAPI + Pydantic 모델 기반 타입 안전 API
- 비동기 HTTP는 httpx 사용

---

## Circuit Breaker (Resilience4j)

room-server → ticketing-server(결제) 호출에 적용:
- 슬라이딩 윈도우 10회, 실패율 50% 초과 시 차단
- 대기 시간 10초

새로운 서비스 간 동기 호출을 추가할 때는 Circuit Breaker 필요 여부를 검토한다.

---

## Kubernetes / Infra 주의사항

- 환경별 설정은 Kustomize 오버레이로 분리 (dev/prod)
- 서비스 디스커버리는 Kubernetes DNS (예: `redis-service.default.svc.cluster.local`)
- `POD_NAME` 환경변수를 Kafka consumer group ID에 활용 — 배포 시 반드시 주입
- Health check 엔드포인트는 모든 서비스에 존재

---

## AI Instructions

- 기존 계층 구조(Controller → Service → Repository)를 반드시 따른다
- 새로운 서비스 간 통신은 동기(REST)와 비동기(Kafka) 중 어느 패턴이 맞는지 먼저 판단한다
- ticketing/stats-server에 Logback 의존성을 추가하지 않는다 (Log4j2 충돌)
- 새 Kafka 토픽 추가 시 파티션 수와 consumer group ID 패턴을 기존과 맞춘다
- MinIO 업로드 로직은 기존 서비스 패턴을 재사용한다
- 인증이 필요한 엔드포인트는 Traefik ForwardAuth를 통해 처리 — 서비스 내부에서 중복 인증 로직 추가 금지

---

## Anti-Patterns

- 서비스 간 DB 직접 접근 금지 — 반드시 API 또는 Kafka를 통해 통신
- `@Transactional` 을 Controller에 붙이지 않는다
- ticketing/stats-server에 Logback 추가 금지
- WebSocket 없이 폴링으로 실시간 상태를 구현하지 않는다
- 인증 검증 로직을 각 서비스에 직접 구현하지 않는다 (ForwardAuth 위임)
- Kubernetes 환경변수 없이 하드코딩된 서비스 URL 사용 금지
