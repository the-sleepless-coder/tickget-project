# --- 1단계: Java 21 JDK로 애플리케이션 빌드 ---
FROM eclipse-temurin:21-jdk-jammy AS builder
WORKDIR /app

# 1. Gradle 빌드에 필요한 파일만 먼저 복사
COPY gradlew gradlew.bat ./
COPY gradle ./gradle
COPY build.gradle settings.gradle ./

# Windows CRLF → Unix LF 변환 및 실행 권한 부여
RUN apt-get update && apt-get install -y dos2unix && \
    dos2unix ./gradlew && \
    chmod +x ./gradlew && \
    rm -rf /var/lib/apt/lists/*

# 2. [속도 최적화] 의존성 다운로드 레이어 분리 + BuildKit 캐시
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew dependencies -x test

# 3. 소스 코드 복사
COPY src ./src

# 4. 애플리케이션 빌드 (캐시된 의존성 사용)
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew build -x test

# --- 2단계: Java 21 JRE로 최종 런타임 이미지 생성 ---
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# 1단계(builder)에서 빌드된 JAR 파일을 app.jar라는 이름으로 복사
COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8084
ENTRYPOINT ["java", "-jar", "app.jar"]
