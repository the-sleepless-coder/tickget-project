### 프로젝트 개요
대용량 트래픽을 발생시켜 실제와 유사한 환경에서 티켓팅을 연습할 수 있는 사이트


### 어플리케이션 주요 기능 
    · 봇을 추가해 (최대 1만개) 최대한 실제와 유사한 환경에서 티켓팅 연습
    · 전체 인원에서 나의 등수 및 각 구간별 시간 확인 가능

   1. 정해진 티켓팅 이벤트가 시작될 때까지 대기한다.
<img width="1154" height="569" alt="image" src="https://github.com/user-attachments/assets/cc0839e8-0d77-4838-b8b4-ff26f2fa61ea" />

   2. 입장한 순서대로 대기열에 진입한다.
<img width="530" height="408" alt="image" src="https://github.com/user-attachments/assets/749b7cae-300c-444c-9a9a-6c0292bb1b6e" />

   3. 보안문자를 입력한다.
<img width="554" height="449" alt="image" src="https://github.com/user-attachments/assets/f7cf69b2-ee3c-41ee-a5ff-7164b0148c27" />

  4. 좌석을 선택한다.
 <img width="530" height="409" alt="image" src="https://github.com/user-attachments/assets/6c6d5e3e-8d35-42c9-8701-db3e99be211e" />

  5. 전체 사용자 및 봇 포함 사용자 중에서 내가 몇등한지 확인한다. 각 구간별 기록도 함께 확인한다.
<img width="1145" height="566" alt="image" src="https://github.com/user-attachments/assets/72014c5a-35f5-4da1-8448-f964bad8b35e" />
 
  6.마이페이지에서 나의 기록을 확인할 수 있다. 한편 매주 업데이트 되는 랭킹을 실시간으로 조회 가능하다.
  <img width="951" height="1122" alt="image" src="https://github.com/user-attachments/assets/1f914bb3-006b-4cd3-ad8d-04c56937b38e" />

  <img width="922" height="1121" alt="image" src="https://github.com/user-attachments/assets/86bc5855-e95d-4f83-98d7-c331fa91cc6b" />

 

### 🔧 주요 기술 스택 및 역할
<img width="1937" height="2657" alt="image" src="https://github.com/user-attachments/assets/66344999-75e5-41e5-b73b-720b98747cf4" />

### 1) Backend
1) Spring Boot (Java)

서비스의 핵심 비즈니스 로직을 담당하는 백엔드 프레임워크

사용자, 티켓팅, 룸, 검색, 통계 등 기능별로 마이크로서비스 구조로 분리하여 구현

REST API 기반으로 프론트엔드 및 타 서비스와 통신

서비스 단위로 독립적인 배포 및 스케일링이 가능하도록 설계

2) Flask (Python)

경량 Python 웹 프레임워크를 이용한 보안문자 서버 기능 구현


3) Redis

인메모리 데이터 저장소: 캐싱, 세션 관리, 실시간 데이터 처리에 활용

대기열 구현 시, 각 사용자(봇 포함)의 대기열 진입 시점과 시간이 지남에 따라 대기열 내 등수를 Key값으로 저장.

4) Kafka

이벤트 기반 비동기 메시징 시스템을 이용해, 대기열을 빠져나갔다는 이벤트를 발행

한편 티켓팅이 진행될 때 각 단계에서 넘어갈 시, 사용자의 기록을 MongoDB에 저장하기 위한 데이터를 저장하는 비동기적 처리 구현

5) MySQL

게임방, 경기 데이터, 각 사용자별 통계 데이터 등 관계형 데이터를 저장하기 사용

6) MongoDB

각 단계별 사용자의 기록 데이터를 저장하기 위한 비정형 데이터베이스 사용

로그, 분석 결과 등 유연한 스키마가 필요한 데이터 처리

7) ElasticSearch

대용량 데이터 검색 및 분석 엔진

검색 서버에서 사용되어 티켓팅 좌석 배치도를 선택할 때 빠른 검색 가능

### 2)Frontend
1) React

SPA(Single Page Application) 기반 사용자 인터페이스 구현

컴포넌트 단위 설계를 통해 UI 재사용성과 유지보수성 향상

### 3)Infrastructure / DevOps
1) Kubernetes (K3s)
전체 시스템을 컨테이너 기반으로 운영하는 오케스트레이션 플랫폼으로, 경량 Kubernetes 배포판인 K3s를 사용하여 리소스 효율적인 클러스터를 구성.

11개의 마이크로서비스를 독립적인 Pod 단위로 배포하며, ARM64 아키텍처에 최적화된 이미지를 사용.

2) Traefik (Ingress Controller)
외부 트래픽을 클러스터 내부 서비스로 라우팅하는 Ingress Controller 사용

IngressRoute와 StripPrefix 미들웨어를 활용하여 도메인 기반 라우팅(tickget.kr) 및 서비스별 경로 분산(/api/v1/{env}/{service})을 처리

3) Auth Server
Google OAuth2 기반 사용자 인증 및 JWT 토큰 발급을 담당합니다. Access Token(7일) 및 Refresh Token(30일) 관리를 통해 인증 로직을 중앙 집중화하여 보안성과 확장성을 확보했습니다.

4) Prometheus & Grafana
Spring Boot Actuator를 통해 시스템 및 애플리케이션 메트릭을 수집하고(/actuator/metrics, /actuator/health), Grafana 대시보드에서 서비스 상태 및 리소스 사용량을 실시간으로 모니터링

Loki를 활용한 로그 수집 및 쿼리도 지원.

5) MinIO
S3 호환 오브젝트 스토리지로 사용자 프로필 이미지, 공연장 썸네일, AI 분석 결과물 등을 저장.

Java(MinioClient) 및 Python(minio) 클라이언트를 통해 각 마이크로서비스와 통합.

6) Nginx
Frontend 컨테이너 내에서 SPA 라우팅을 처리하며, Gzip 압축 및 정적 파일 캐싱(1년)을 통해 성능을 최적화.

모든 클라이언트 라우트를 index.html로 리다이렉트하여 React/Vue SPA를 지원.


### 본인 구현 사항
·  Redis ZSET을 활용한, 대기열 기능 구현 

·  Match 메타 데이터 및 Ranking 집계하는, 통계 서버 구현 

· Kafka/Redis 기반 Event-Driven 데이터 처리 파이프라인 구축

·  Explain/Analyze문을 통해 쿼리 실행 계획, 실행문을 확인해, 쿼리 성능 최적화

·  보안문자 기능 구현

·  Grafana, Loki 등 모니터링 툴을 통한 문제 상황 진단 및 디버깅 



### 기술적 세부 사항
[BackEnd]
<br>
1) Redis ZSET을 활용한, 대기열 순서 및 Dequeue 기능 구현
   
· Redis ZSET을 활용,
Packet의 메시지 큐 도착 시간이 아닌 Timestamp 기준 정렬

대기열 내 실시간 순위 조회, 클릭 순서에 따른 대기열 구현 코드 작성

· Kafka/Redis 기반, Event-Driven 데이터 처리 파이프라인 구축

-> 일정 주기 마다 N명이 빠져나가는 상태를 구현

-> 대기열 내 순서를 전파하기 위해 Redis에 각 사용자의 등수 업데이트

-> 대기열 빠져나감 상태를 전파하기 위해 Kafka에 Dequeue 상태를 발행

<br>
2) Match Meta 데이터 및 Ranking 집계하는, 통계 서버 구축

· Ranking 알고리즘 구현

->등수 점수 기반, 총 인원수, 난이도, 구간별 기록 등 반영해 랭킹 점수에 반영

· 매치 메타 데이터 및 랭킹 집계 경기가 끝날 때마다, 경기에 대한 메타 데이터 및 랭킹 집계

· 일정 시간에 배치 단위로 DB에 삽입해서, 영속적인 데이터로 적재

<br>
 3)Explain/Analyze 이용 쿼리 실행계획/실행문 확인,쿼리 성능 최적화 
    
·  미집계된 match stats 정보 조회 시, user stats, match stats에서 필요한 colum에 인덱스를 부여
    
·  읽어야 할 데이터에 대한 I/O 비용 하락으로 DB 탐색 성능 대폭 증가


### ERD
<img width="1604" height="836" alt="TickGet_ERD" src="https://github.com/user-attachments/assets/105563f0-08f7-4673-8f75-70110c6c49f0" />

- 참고 사이트
[1] https://kopis.or.kr/
