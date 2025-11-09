# 멀티 스테이지 빌드 - Go 애플리케이션용
# Stage 1: 빌드 스테이지
FROM golang:1.25.3-alpine AS builder

# 빌드에 필요한 패키지 설치
RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Go 모듈 파일 복사 및 의존성 다운로드
COPY go.mod go.sum ./
RUN go mod download

# 소스 코드 복사
COPY . .

# 바이너리 빌드 (정적 링크)
# CGO_ENABLED=0: 정적 바이너리 생성 (alpine에서 실행 가능)
RUN CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -a -installsuffix cgo -o bot-server .

# Stage 2: 실행 스테이지
FROM alpine:latest

# CA 인증서 설치 (HTTPS 통신용)
RUN apk --no-cache add ca-certificates

WORKDIR /app

# 빌드된 바이너리 복사
COPY --from=builder /app/bot-server .

# 포트 노출
EXPOSE 8080

# 헬스체크 (선택사항)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# 실행
CMD ["./bot-server"]
