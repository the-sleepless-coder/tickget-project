# --- 1단계: Java 21 JDK로 애플리케이션 빌드 ---
FROM eclipse-temurin:21-jdk-jammy AS builder
WORKDIR /app

# 모든 파일을 한 번에 복사 (Windows 크로스 플랫폼 빌드 호환성)
COPY . .

# Windows CRLF → Unix LF 변환 및 실행 권한 부여
RUN apt-get update && apt-get install -y dos2unix && \
    dos2unix ./gradlew && \
    chmod +x ./gradlew && \
    rm -rf /var/lib/apt/lists/*

# Gradle wrapper 초기화 및 빌드
RUN ./gradlew clean build -x test --no-daemon

# --- 2단계: Java 21 JRE로 최종 런타임 이미지 생성 ---
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# 1단계(builder)에서 빌드된 JAR 파일을 app.jar라는 이름으로 복사
COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
