### 프로젝트 개요
Tickget은 실제와 유사한 환경에서 티켓팅을 연습할 수 있는 트래픽 시뮬레이터입니다. 

최대 5만 개의 봇이 실제 유저와 함께 대기열에 진입하고, Redis ZSET이 실시간 등수를 매기고, 경기가 끝나면 통계 서버가 랭킹을 집계합니다.

## Overview
 
대용량 트래픽을 직접 발생시켜 티켓팅 전 과정(대기열 → 보안문자 → 좌석 선택 → 결과 확인)을 연습하고, 전체 참가자 중 나의 등수와 구간별 소요 시간을 확인할 수 있는 서비스입니다. 

**"수만 명이 동시에 몰리는 대기열에서, 등수를 실시간으로, 정확하게, 유실 없이 보여주도록 구현하였습니다."**

   1. 대기열 단계
<img width="530" height="408" alt="image" src="https://github.com/user-attachments/assets/749b7cae-300c-444c-9a9a-6c0292bb1b6e" />

   2. 보안문자 단계
<img width="554" height="449" alt="image" src="https://github.com/user-attachments/assets/f7cf69b2-ee3c-41ee-a5ff-7164b0148c27" />

  3. 좌석 선택 단계
 <img width="530" height="409" alt="image" src="https://github.com/user-attachments/assets/6c6d5e3e-8d35-42c9-8701-db3e99be211e" />

  4. 기록 확인 단계
  <img width="1145" height="566" alt="image" src="https://github.com/user-attachments/assets/72014c5a-35f5-4da1-8448-f964bad8b35e" /> 

## Key Features
 
- **실전형 대기열** — 봇 최대 5만 개를 투입해 실제 티켓팅과 유사한 경쟁 환경 재현
- **실시간 등수 조회** — Redis ZSET 기반 정렬 삽입/조회로 나의 대기 순번을 즉시 확인
- **이벤트 기반 상태 전파** — 대기열 이탈 이벤트를 Kafka로 발행, Room Server가 구독 후 STOMP로 프론트엔드에 재발행
- **구간별 기록 측정** — 대기열/보안문자/좌석선택 각 단계의 소요 시간을 MongoDB에 로그로 적재
- **랭킹 집계** — 등수·총 인원·난이도·구간별 기록을 차등 반영한 랭킹 점수 산정, 주간 랭킹 제공
- **분산 정합성** — Saga 패턴(보상 트랜잭션) + Kafka Outbox + HTTP Retry로 DB/Redis/Kafka 간 상태 일관성 유지


## Data Flow
 
```
User / Bot (최대 10,000)
      ↓  대기열 진입
Redis ZSET  ──  진입 시각 score → 실시간 등수 삽입/조회
      ↓  dequeue
Kafka  ──  대기열 이탈 이벤트 발행
      ↓
Room Server  ──  Kafka 구독 → 세션 확인된 사용자에게 STOMP 재발행
      ↓  티켓팅 진행 (보안문자 → 좌석 선택)
Kafka → MongoDB  ──  단계별 소요 시간 로그 (비동기 적재)
      ↓  경기 종료
Stats Server  ──  랭킹 점수 산정 (등수·총인원·난이도·구간 기록)
      ↓  스케줄러 배치
MySQL  ──  경기 메타데이터·랭킹 영속 적재 → 주간 랭킹 조회
```

 ## Repository Structure
 
```
tickget-project/             (branch: dev)
├── AI/                      # AI 분석 (Python)
├── Backend/                 # 마이크로서비스 9종
│   ├── ticketing-server/    # Java — 대기열(ZSET·Kafka·Outbox·스케줄러) + 좌석(동시성 제어·Redis·MongoDB)
│   ├── room-server/         # Java — 방 생성/관리 · Kafka 구독 → STOMP 세션 전파 · Redis Lua 스크립트
│   ├── stats-server/        # Java — 경기/개인/랭킹 집계 · 미집계 재처리 스케줄러
│   ├── auth-server/         # Java — Google OAuth2 · JWT 발급/검증 필터
│   ├── user-server/         # Java — 사용자 정보 · 마이페이지
│   ├── search-server/       # Java — ElasticSearch 기반 검색
│   ├── bot-server/          # Go — 봇 트래픽 생성 (match · scheduler · kafka · stats)
│   ├── catpcha-server/      # Python/Flask — 보안문자 생성/검증
│   └── test-server/         # 실험용 — MySQL/MongoDB 연동 검증
├── Frontend/                # React SPA (Nginx 서빙)
├── infra/                   # MySQL 초기화 스크립트
├── .gitlab-ci.yml           # GitLab CI 파이프라인
├── docker-compose.yml       # 로컬 인프라 구성
├── requirements.txt         # Python 의존성 (Captcha/AI)
└── README.md
```

## Design Patterns
 
| 패턴 | 설명 |
|---|---|
| **Redis ZSET Ranking** | 정렬된 상태로 삽입/조회 — Kafka 구독 데이터 재정렬에 드는 시간 복잡도 제거 |
| **Event-Driven Propagation** | Kafka 이벤트 → Room Server → STOMP 재발행으로 대기열 상태를 프론트까지 전파 |
| **Saga (보상 트랜잭션)** | 방 설정 저장/경기 시작 상태 변경을 서버별 로컬 트랜잭션 + 보상 트랜잭션으로 구성, DB·Redis·Kafka 상태를 일관 관리 |
| **Outbox + HTTP Retry** | 비동기(Kafka Outbox — ticketing-server queue 모듈에 구현)와 동기(HTTP retry)를 상황별로 적용해 재시도·멱등성 확보 |
| **Batch Aggregation** | 경기 종료마다 메타데이터·랭킹 집계, 일정 주기 배치로 DB 영속 적재 |

### 🔧 주요 기술 스택 및 역할
<img width="1937" height="2657" alt="image" src="https://github.com/user-attachments/assets/66344999-75e5-41e5-b73b-720b98747cf4" />

## My Contributions
 
| 구현 항목 | 기여도 |
|---|---|
| Redis/Kafka 기반 대기열 등수 업데이트·dequeue | 100% |
| 경기 메타데이터/랭킹 집계 통계 서버 구축 | 100% |
| Captcha 서버 보안문자 생성 | 100% |
| Redis 기반 최종 사용자 등수 집계 | 100% |
| MongoDB 기반 단계별 소요 시간 로그 | 33% |
| Grafana·Loki 모니터링 기반 문제 진단/디버깅 | — |

## Tech Stack
 
```
Backend   : Spring Boot (Java) · Flask (Python) · Redis · Kafka · MySQL · MongoDB · ElasticSearch
Frontend  : React · Nginx
Infra     : Kubernetes (K3s) · Traefik · MinIO · Prometheus · Grafana · Loki · GitLab CI
Auth      : Google OAuth2 · JWT (Access 7d / Refresh 30d)
```
 
## License
 
None declared — team project (SSAFY).

### ERD
<img width="1536" height="1024" alt="자율프로젝트_ERD" src="https://github.com/user-attachments/assets/9b315e4e-60c8-41f2-b241-89c72762b815" />


- 참고 사이트
[1] https://kopis.or.kr/
