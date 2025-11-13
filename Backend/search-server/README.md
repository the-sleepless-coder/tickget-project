# Search-Server

Elasticsearch 기반 공연장 검색 마이크로서비스

## 개요

- **프레임워크**: Spring Boot 3.5.6 + Java 21
- **검색 엔진**: Elasticsearch 8.11.0
- **목적**: concert-halls 인덱스에서 공연장 이름 자동완성 검색
- **포트**: 8084 (내부), 80 (Service)
- **API Prefix**: `/api/v1/dev/search`

## 주요 기능

- **자동완성 검색**: N-gram 기반 한글/영문 공연장 이름 검색
- **상세 조회**: ID로 특정 공연장 정보 조회
- **Health Check**: Actuator 기반 상태 확인

## Elasticsearch 연동

### 인덱스 정보
- **인덱스명**: concert-halls
- **총 도큐먼트**: 3,230개
- **필드**:
  - `name` (text + name.ngram + name.keyword)
  - `total_seat` (integer)
  - `created_at` (date)

### 분석기
- **korean**: Nori tokenizer (형태소 분석)
- **korean_ngram**: Edge N-gram (1-20자, 자동완성)

## API 엔드포인트

### 1. 공연장 검색
```http
GET https://tickget.kr/api/v1/dev/search/concerts/halls?q=예술&size=20
```

**Query Parameters**:
- `q` (required): 검색 키워드
- `size` (optional): 결과 개수 (default: 20)

**Response**:
```json
{
  "total": 359,
  "took": 5,
  "results": [
    {
      "id": "1",
      "name": "예술의전당 콘서트홀",
      "totalSeat": 2523,
      "score": 3.64
    }
  ]
}
```

### 2. 공연장 상세 조회
```http
GET https://tickget.kr/api/v1/dev/search/concerts/halls/{id}
```

**Response**:
```json
{
  "id": "1",
  "name": "예술의전당 콘서트홀",
  "totalSeat": 2523
}
```

### 3. Health Check
```http
GET https://tickget.kr/api/v1/dev/search/actuator/health
```

## 로컬 개발

### 전제조건
- Java 21
- Gradle
- Elasticsearch 8.11.0 (로컬 또는 K8s)

### 빌드 및 실행
```bash
# 빌드
./gradlew build

# 실행 (로컬 Elasticsearch)
export ELASTICSEARCH_HOSTS=http://localhost:9200
./gradlew bootRun

# 실행 (K8s Elasticsearch - port-forward)
kubectl port-forward -n default svc/elasticsearch-service 9200:9200
export ELASTICSEARCH_HOSTS=http://localhost:9200
./gradlew bootRun
```

### 테스트
```bash
# 검색 테스트
curl "http://localhost:8084/concerts/halls?q=예술"

# Health Check
curl http://localhost:8084/actuator/health
```

## Docker 빌드

### ARM64 빌드 (K3s 배포용)
```bash
# Docker BuildX 사용
docker buildx build --platform linux/arm64 \
  -t kkaebu/tickget-search-server:dev-latest \
  --push .
```

### 로컬 테스트 (AMD64)
```bash
docker build -t search-server:local .
docker run -p 8084:8084 \
  -e ELASTICSEARCH_HOSTS=http://host.docker.internal:9200 \
  search-server:local
```

## Kubernetes 배포

### 배포 명령어
```bash
# Dev 환경 배포
kubectl apply -k tickget-k8s-manifests/apps/search-server/overlays/dev

# 상태 확인
kubectl get pods -n dev -l app=search-server
kubectl logs -n dev -l app=search-server --tail=100

# 서비스 확인
kubectl get svc -n dev search-server-service
```

### IngressRoute 확인
```bash
kubectl get ingressroute -n dev search-server-route -o yaml
```

### 테스트
```bash
# 외부 접근
curl "https://tickget.kr/api/v1/dev/search/concerts/halls?q=예술"

# Pod 내부 접근
kubectl exec -n dev <pod-name> -- \
  curl "http://search-server-service/concerts/halls?q=예술"
```

## 리소스 할당

### Dev 환경
```yaml
replicas: 1
resources:
  requests:
    memory: 128Mi
    cpu: 50m
  limits:
    memory: 256Mi
    cpu: 200m
```

**근거**:
- 경량 검색 서비스 (Elasticsearch 쿼리만 수행)
- 자체 DB 없음 (Stateless)
- Captcha-server와 유사한 리소스 프로필

## 아키텍처

```
Client → Traefik Ingress
  ↓ (StripPrefix: /api/v1/dev/search)
search-server-service (ClusterIP)
  ↓ (port 80 → 8084)
search-server Pod
  ↓ (Elasticsearch Java Client)
elasticsearch-service.default.svc.cluster.local:9200
  ↓
concert-halls 인덱스 (3,230 docs)
```

## 모니터링

### Logs (Loki + Grafana)
```bash
# Grafana에서 검색
{namespace="dev", app="search-server"}
{namespace="dev", app="search-server"} |= "Search"
{namespace="dev", app="search-server"} |= "ERROR"
```

### Metrics
```bash
# Actuator 메트릭
curl https://tickget.kr/api/v1/dev/search/actuator/health
```

## Swagger UI

**URL**: https://tickget.kr/api/v1/dev/search/swagger-ui.html

**Note**: StripPrefix로 인해 `/api/v1/dev/search` 제거 후 라우팅됨

## 트러블슈팅

### Elasticsearch 연결 실패
```bash
# Elasticsearch 상태 확인
kubectl get pods -n default | grep elasticsearch
kubectl logs -n default elasticsearch-0 --tail=50

# 네트워크 테스트
kubectl exec -n dev <search-server-pod> -- \
  curl http://elasticsearch-service.default.svc.cluster.local:9200
```

### 검색 결과 없음
```bash
# 인덱스 확인
kubectl exec -n default elasticsearch-0 -- \
  curl -X GET "localhost:9200/concert-halls/_count"

# 매핑 확인
kubectl exec -n default elasticsearch-0 -- \
  curl -X GET "localhost:9200/concert-halls/_mapping"
```

### Pod Pending 상태
```bash
# 리소스 부족 확인
kubectl describe pod -n dev <search-server-pod>
kubectl top nodes
```

## 참고 문서

- [Elasticsearch Java Client 8.11.0](https://www.elastic.co/guide/en/elasticsearch/client/java-api-client/8.11/index.html)
- [Spring Boot Actuator](https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html)
- [Traefik IngressRoute](https://doc.traefik.io/traefik/routing/providers/kubernetes-crd/)

## 작성자

SSAFY 13th A209 - TickGet Team
