# --- 1단계: Java 21 JDK로 애플리케이션 빌드 ---
# 'builder'라는 이름의 빌드 환경을 정의합니다.
FROM eclipse-temurin:21-jdk-jammy AS builder

# 작업 디렉터리를 /app으로 설정합니다.
WORKDIR /app

# Gradle 래퍼 파일들을 복사합니다.
COPY gradlew gradlew.bat ./
COPY gradle ./gradle

# build.gradle과 settings.gradle 파일을 복사합니다.
COPY build.gradle settings.gradle ./

# gradlew 스크립트에 실행 권한을 부여합니다.
RUN chmod +x ./gradlew

# 소스 코드를 복사합니다.
COPY src ./src

# Gradle 래퍼를 사용해 애플리케이션을 빌드합니다. (테스트는 제외)
RUN ./gradlew build -x test

# --- 2단계: Java 21 JRE로 최종 런타임 이미지 생성 ---
# 더 가벼운 JRE 이미지를 기반으로 최종 이미지를 만듭니다.
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# 1단계(builder)에서 빌드된 JAR 파일을 app.jar라는 이름으로 복사합니다.
# Gradle은 build/libs/ 폴더에 JAR 파일을 생성합니다.
COPY --from=builder /app/build/libs/*.jar app.jar

# Spring Boot의 기본 포트인 8080을 노출합니다.
EXPOSE 8080

# 컨테이너가 시작될 때 app.jar를 실행합니다.
ENTRYPOINT ["java", "-jar", "app.jar"]