# --- 1단계: Java 21 JDK로 애플리케이션 빌드 ---
FROM eclipse-temurin:21-jdk-jammy AS builder
WORKDIR /app

# 1. Gradle 빌드에 필요한 파일만 먼저 복사
COPY gradlew gradlew.bat ./
COPY gradle ./gradle
COPY build.gradle settings.gradle ./
RUN chmod +x ./gradlew

# 2. [속도 최적화] 의존성 다운로드 레이어 분리
# build.gradle이 변경되지 않는 한, 이 레이어는 캐시됨
RUN ./gradlew dependencies -x test

# 3. 소스 코드 복사
# Java 코드만 변경되면 Docker는 1, 2번 레이어를 재사용함
COPY src ./src

# 4. 애플리케이션 빌드 (캐시된 의존성 사용)
# 이 단계는 소스 코드가 변경되었을 때만 다시 실행되며, 훨씬 빠름
RUN ./gradlew build -x test

# --- 2단계: Java 21 JRE로 최종 런타임 이미지 생성 ---
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# 1단계(builder)에서 빌드된 JAR 파일을 app.jar라는 이름으로 복사
COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]