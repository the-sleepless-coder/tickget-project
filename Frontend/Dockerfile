# ===== 1단계: 빌드 스테이지 =====
FROM node:20-alpine AS builder

WORKDIR /app

# 의존성 설치를 위한 파일만 먼저 복사 (캐싱 최적화)
COPY package.json package-lock.json ./

# 의존성 설치 + npm 캐시 마운트로 재빌드 시 속도 향상
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# 소스 코드 복사
COPY . .

# 빌드 시 환경 변수 ARG로 받기
ARG VITE_API_PREFIX_DEV=/api/v1/dev
ARG VITE_API_ORIGIN=
#ARG VITE_API_PREFIX=/api/v1
#ARG VITE_ROOM_SERVER_URL=
#ARG VITE_TICKETING_SERVER_URL=

# ENV로 변환하여 Vite 빌드 시 사용
ENV VITE_API_PREFIX_DEV=$VITE_API_PREFIX_DEV
ENV VITE_API_ORIGIN=$VITE_API_ORIGIN
#ENV VITE_API_PREFIX=$VITE_API_PREFIX
#ENV VITE_ROOM_SERVER_URL=$VITE_ROOM_SERVER_URL
#ENV VITE_TICKETING_SERVER_URL=$VITE_TICKETING_SERVER_URL

# 프로덕션 빌드 (타입 체크 건너뛰고 Vite만 빌드)
RUN npx vite build

# ===== 2단계: 프로덕션 스테이지 =====
FROM nginx:alpine

# 빌드된 파일을 Nginx 정적 파일 디렉토리로 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# 커스텀 Nginx 설정 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Nginx 실행 (포트 80)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
