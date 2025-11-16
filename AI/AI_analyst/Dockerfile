# 1. ARM64 아키텍처와 호환되는 Python 기반 이미지를 사용합니다.
FROM --platform=linux/arm64 python:3.11-slim-bookworm

WORKDIR /app

# 2. OpenCV 실행에 필요한 시스템 라이브러리를 설치합니다.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

# 3. requirements.txt를 먼저 복사하여 pip install을 캐시합니다.
COPY requirements.txt .

# 4. Python 패키지를 설치합니다.
RUN pip install --no-cache-dir -r requirements.txt

# 5. 애플리케이션 코드 전체를 복사합니다.
COPY . .

# 6. FastAPI 앱이 실행될 포트(8000)를 노출합니다.
EXPOSE 8000

# 7. main_modular.py 파일 하단에 명시된 uvicorn 명령어로 앱을 실행합니다.
CMD ["uvicorn", "analysis_main:app", "--host", "0.0.0.0", "--port", "8000"]