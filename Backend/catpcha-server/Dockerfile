FROM docker.io/library/python:3.10

# Pillow 빌드에 필요한 네이티브 라이브러리 + 빌드툴
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential pkg-config \
    libjpeg62-turbo-dev libpng-dev zlib1g-dev \
    libtiff5-dev libopenjp2-7-dev \
    libfreetype6-dev liblcms2-dev libwebp-dev \
    libharfbuzz-dev libfribidi-dev libxcb1-dev \
    tcl8.6-dev tk8.6-dev python3-tk \
    ffmpeg espeak python3-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PIP_CONFIG_FILE=/app/pip.conf

COPY requirements.txt .
# (옵션) 휠 툴 최신화
RUN python -m pip install --upgrade pip setuptools wheel \
&& pip install --no-cache-dir -r requirements.txt

# captcha.cfg.example 파일을 이미지 안으로 복사하고 환경변수 등록
RUN mkdir -p /app/captcha_api
COPY captcha_api/captcha.cfg.example /app/captcha_api/captcha.cfg
ENV CAPTCHA_API_CONFIG=/app/captcha_api/captcha.cfg

COPY . .
EXPOSE 8080
CMD ["sh", "-c", "python3 -m captcha_api.db && gunicorn --bind 0.0.0.0:8080 wsgi:app"]
