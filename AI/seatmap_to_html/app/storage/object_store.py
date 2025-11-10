# app/storage/object_store.py
from __future__ import annotations
import io, time
from pathlib import Path
from typing import Optional, Dict, Any
from minio.error import S3Error
from app.config import (
    MINIO_BUCKET, MINIO_PUBLIC_BASE, MINIO_ENDPOINT, MINIO_SECURE,
    OUT_RESULT_DIR, MINIO_OUT_PREFIX  # ← 추가
)
from app.storage.minio_client import get_minio, ensure_bucket

def normalize_key(object_name: str, hall_id: Optional[str | int]) -> str:
    parts = []
    if MINIO_OUT_PREFIX:
        parts.append(MINIO_OUT_PREFIX)                     # ex) "halls"
    if hall_id not in (None, ""):
        parts.append(str(hall_id).strip("/"))              # ex) "11"
    parts.append(object_name.lstrip("/"))                  # ex) "image001.tsx"
    return "/".join(parts)                                 # "halls/11/image001.tsx"


def guess_content_type(key: str, default: str = "text/plain; charset=utf-8") -> str:
    k = key.lower()
    if k.endswith(".tsx"):  return "text/tsx; charset=utf-8"
    if k.endswith(".ts"):   return "application/typescript; charset=utf-8"
    if k.endswith(".js"):   return "application/javascript; charset=utf-8"
    if k.endswith(".json"): return "application/json; charset=utf-8"
    if k.endswith(".html"): return "text/html; charset=utf-8"
    if k.endswith(".svg"):  return "image/svg+xml"
    return default

def build_public_url(bucket: str, key: str) -> str:
    if MINIO_PUBLIC_BASE:
        return f"{MINIO_PUBLIC_BASE.rstrip('/')}/{bucket}/{key}"
    scheme = "https" if MINIO_SECURE else "http"
    return f"{scheme}://{MINIO_ENDPOINT.rstrip('/')}/{bucket}/{key}"

def save_bytes_to_object_store(
    data: bytes,
    *,
    object_name: str,
    hall_id: Optional[str | int] = None,
    content_type: Optional[str] = None,
    max_retries: int = 3,
    retry_backoff_base: float = 0.6,
) -> Dict[str, Any]:
    """
    MinIO에 업로드(재시도) + 로컬 폴백 보장.
    반환: { ok, s3, local, error }
    """
    key   = normalize_key(object_name, hall_id)
    ctype = content_type or guess_content_type(key)

    # 1) 로컬 폴백(항상 저장)
    local_dir = Path(OUT_RESULT_DIR) / (str(hall_id) if hall_id not in (None, "") else "")
    local_dir.mkdir(parents=True, exist_ok=True)
    local_path = local_dir / Path(key).name
    try:
        local_path.write_bytes(data)
    except Exception as e:
        return {
            "ok": False,
            "s3": None,
            "local": {"path": str(local_path), "saved": False},
            "error": f"Local save failed: {e}",
        }

    # 2) MinIO 업로드(버킷 보장 + 재시도)
    try:
        ensure_bucket(MINIO_BUCKET)
    except S3Error as e:
        return {
            "ok": False,
            "s3": None,
            "local": {"path": str(local_path), "saved": True},
            "error": f"S3 bucket check/create failed: {e.code} - {e.message}",
        }

    cli = get_minio()
    last_err: Optional[Exception] = None
    for attempt in range(1, max_retries + 1):
        try:
            stream = io.BytesIO(data)
            cli.put_object(
                MINIO_BUCKET,
                key,
                stream,
                length=len(data),
                content_type=ctype,
            )
            return {
                "ok": True,
                "s3": {
                    "bucket": MINIO_BUCKET,
                    "key": key,
                    "url": build_public_url(MINIO_BUCKET, key),
                },
                "local": {"path": str(local_path), "saved": True},
                "error": None,
            }
        except Exception as e:
            last_err = e
            if attempt < max_retries:
                time.sleep(retry_backoff_base * (2 ** (attempt - 1)))

    # 3) 실패 상세
    if isinstance(last_err, S3Error):
        err = f"S3 put failed: {last_err.code} - {last_err.message} | " \
              f'{{"hints":["Check endpoint/secure","Verify access/secret",' \
              f'"Ensure PutObject on {MINIO_BUCKET}/{key.split("/")[0]}/*","Check bucket policy","Sync clocks"]}}'
    else:
        err = f"S3 put failed: {last_err}"
    return {
        "ok": False,
        "s3": None,
        "local": {"path": str(local_path), "saved": True},
        "error": err,
    }
