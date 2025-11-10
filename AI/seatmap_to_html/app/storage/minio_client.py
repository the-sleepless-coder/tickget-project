# app/storage/minio_client.py
from __future__ import annotations
from typing import Optional
from minio import Minio
from minio.error import S3Error
from app.config import (
    MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_SECURE, MINIO_BUCKET
)

_MINIO: Optional[Minio] = None

def get_minio() -> Minio:
    """지연 초기화된 MinIO 클라이언트 반환"""
    global _MINIO
    if _MINIO is None:
        _MINIO = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_SECURE,
        )
    return _MINIO

def ensure_bucket(bucket: str = MINIO_BUCKET) -> None:
    """버킷 존재 보장 (권한 없으면 AccessDenied 발생)"""
    cli = get_minio()
    try:
        if not cli.bucket_exists(bucket):
            cli.make_bucket(bucket)
    except S3Error as e:
        # 경쟁/중복 생성 이슈 무시
        if e.code in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
            return
        raise
