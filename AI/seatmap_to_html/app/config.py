# app/config.py
from __future__ import annotations
import os
from pathlib import Path

# MinIO & 저장 경로 환경설정
MINIO_ENDPOINT    = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY  = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY  = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET      = os.getenv("MINIO_BUCKET", "tickget-dev")
MINIO_SECURE      = os.getenv("MINIO_SECURE", "false").lower() == "true"
MINIO_PUBLIC_BASE = os.getenv("MINIO_PUBLIC_BASE", "")  # e.g. https://minio.example.com

MINIO_OUT_PREFIX = os.getenv("MINIO_OUT_PREFIX", "").strip("/")


OUT_RESULT_DIR    = os.getenv("OUT_RESULT_DIR", "/mnt/data/result")
Path(OUT_RESULT_DIR).mkdir(parents=True, exist_ok=True)
HALLS_BASE_URL = os.getenv("HALLS_BASE_URL", "https://tickget.kr/api/v1/dev/rms/halls")