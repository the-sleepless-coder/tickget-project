# 핵심 규칙:
#  - color_delta = 22 고정
#  - 텍스트형 폴리곤 제거
#  - 회색/검정 기본 렌더 제외, 단 "STAGE"와 겹치면 강제 렌더(등급 산정 제외)
#  - 폴리곤이 너무 작으면 렌더링 제외(min_render_area)
#  - OCR 실패 시 템플릿 기반 fallback STAGE 박스 합성
#  - STAGE 좌표와 겹치는 폴리곤은 색상과 무관하게 비상호작용 처리
#  - 등급 매핑(색상 그룹 수):
#      1개=R / 2개=VIP,R / 3개=VIP,R,S / 4개 이상=STANDING,VIP,R,S
#  - 거리 기준: “STAGE 폴리곤 중앙-하단(bottom-center)”과 각 폴리곤 중심 사이 거리
#  - 색상 그룹별 ‘평균 거리’로 가까운 그룹이 상위 등급
#  - git test 중

from __future__ import annotations
from fastapi import FastAPI, APIRouter, UploadFile, File, Form, Response, HTTPException, Request
from pathlib import Path
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from s3_client import S3Client
import os, re, json, math, io, logging
import numpy as np
import cv2
from dotenv import load_dotenv

load_dotenv(override=False)  # 이미 셸에 있으면 .env가 덮어쓰지 않음
LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.DEBUG),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

from app.storage.object_store import save_bytes_to_object_store
from app.config import HALLS_BASE_URL, MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_SECURE
import time

logger = logging.getLogger("tickget.halls")
logger.propagate = True  # uvicorn 핸들러로도 올라가게
# 핵심 환경값 에코 (민감 정보 노출 금지)
logger.info("CFG HALLS_BASE_URL=%s", os.getenv("HALLS_BASE_URL"))
_token = (os.getenv("TICKGET_API_TOKEN") or os.getenv("HALLS_API_TOKEN") or "").strip()
logger.info("CFG token_present=%s token_len=%d", bool(_token), len(_token))

from utils_stage import (
    DEBUG_REGION_SNAPSHOTS, DEBUG_OUTDIR, _dbg_tag, _dbg_dump,
    build_gray_mask, strip_text_regions, find_stage_polygon, segment_with_text_robust, 
    auto_min_area, is_ribbon_like, suppress_inner_islands,
    suppress_nested_samegroup, suppress_subpolys_samegroup_mask
)

import httpx
from httpx import HTTPStatusError

# OCR support removed

# ----------------------------
# Paths / Dirs
# ----------------------------

API_BASE = os.environ.get("TICKGET_API_BASE", "https://tickget.kr/api/v1/dev/rms")
API_TOKEN = os.environ.get("TICKGET_API_TOKEN")
BASE_DIR   = Path("/mnt/data")
DATA_DIR   = BASE_DIR / "STH_v1" / "data"
RESULT_DIR = BASE_DIR / "result"
META_DIR   = BASE_DIR / "meta"
DEBUG_DIR  = BASE_DIR / "debug"

for d in (DATA_DIR, RESULT_DIR, META_DIR, DEBUG_DIR):
    d.mkdir(parents=True, exist_ok=True)

HALLS_API_BASE = os.environ.get("HALLS_API_BASE", "").rstrip("/")
HALLS_API_ENDPOINT = os.environ.get("HALLS_API_ENDPOINT", "/halls")

print(MINIO_ENDPOINT,MINIO_ACCESS_KEY,MINIO_SECRET_KEY,MINIO_BUCKET,MINIO_SECURE)
# MINIO_ENDPOINT   = os.environ.get("MINIO_ENDPOINT", "localhost:9000")
# MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
# MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "minioadmin")
# MINIO_BUCKET     = os.environ.get("MINIO_BUCKET", "tickget")
# MINIO_SECURE     = os.environ.get("MINIO_SECURE", "false").lower() == "true"

def _get_api_client() -> httpx.Client:
    if not API_TOKEN:
        raise RuntimeError("TICKGET_API_TOKEN is not set (401 방지용 토큰이 필요합니다).")
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Accept": "application/json",
    }
    return httpx.Client(base_url=API_BASE, headers=headers, timeout=20.0)

# def _raise_with_context(resp: httpx.Response, context: str):
#     try:
#         detail = resp.json()
#     except Exception:
#         detail = resp.text
#     raise HTTPException(
#         status_code=502,
#         detail=f"{context} failed (upstream {resp.status_code}). body={detail}"
#     )

# def _ensure_bucket(bucket: str = MINIO_BUCKET) -> None:
#     from minio.error import S3Error
#     try:
#         if not _minio_client.bucket_exists(bucket):
#             _minio_client.make_bucket(bucket)
#     except S3Error:
#         pass

# --- 그대로 사용(주석만 추가) ---
def post_hall_and_get_id(*, name: str, total_seat: int) -> str:
    base = os.environ.get("HALLS_API_BASE", "").rstrip("/")
    endpoint = os.environ.get("HALLS_API_ENDPOINT", "/halls")
    url = f"{base}{endpoint}"

    token = os.getenv("TICKGET_API_TOKEN", "").strip()
    if not token:
        # 토큰이 없으면 즉시 명확한 오류를 반환한다.
        raise RuntimeError("TICKGET_API_TOKEN is not set; cannot call Halls API")

    # 인증 스킴을 환경변수로 제어 (기본: Bearer). X-API-KEY 지원.
    scheme = os.getenv("HALLS_AUTH_SCHEME", "Bearer").strip()

    def _headers_for(s: str) -> dict:
        h = {"Content-Type": "application/json"}
        if s.lower() == "x-api-key":
            h["X-API-KEY"] = token
        else:
            h["Authorization"] = f"{s} {token}".strip()
        return h

    primary_headers = _headers_for(scheme if scheme else "Bearer")
    fallback_headers = _headers_for("X-API-KEY" if scheme.lower() != "x-api-key" else "Bearer")

    payload = {"name": name, "totalSeat": int(total_seat)}

    # 트레일링 슬래시 자동 보정 시도 (원본이 404면 / 붙여 재시도)
    urls_to_try = [url, url + "/"] if not url.endswith("/") else [url, url.rstrip("/")]
    last_err = None

    def _try_once(cli: httpx.Client, target_url: str, headers: dict):
        r = cli.post(target_url, json=payload, headers=headers)
        r.raise_for_status()
        data = r.json()
        # 중첩 응답도 처리
        hall_id = _extract_hall_id_from_json(data) or str(data.get("hallId") or data.get("id") or "").strip()
        if not hall_id:
            raise RuntimeError(f"Invalid hallId response: {data}")
        return hall_id

    for u in urls_to_try:
        try:
            with httpx.Client(timeout=15.0) as cli:
                # 1차: 설정된 스킴으로 시도
                try:
                    return _try_once(cli, u, primary_headers)
                except httpx.HTTPStatusError as e:
                    # 인증 문제 시 한 번 X-API-KEY(또는 Bearer)로 재시도
                    status = e.response.status_code if e.response is not None else None
                    body = None
                    try:
                        body = e.response.json() if e.response is not None else None
                    except Exception:
                        body = (e.response.text if (e.response is not None) else None)
                    auth_hint = "authorization" in (json.dumps(body).lower() if body is not None else "")
                    if status in (401, 403) or auth_hint:
                        # 재시도: 대체 헤더
                        return _try_once(cli, u, fallback_headers)
                    raise
        except httpx.HTTPStatusError as e:
            last_err = e
        except Exception as e:
            last_err = e

    # 두 주소 모두 실패하면 상세 에러 표시
    raise RuntimeError(f"Halls register failed at {urls_to_try}: {last_err}")

# def _put_minio_with_retry(
#     bucket: str,
#     object_name: str,
#     content: bytes,
#     content_type: str,
#     *,
#     max_attempts: int = 4,
#     base_delay: float = 0.6,
# ) -> Tuple[bool, str]:
#     """
#     MinIO put_object with exponential backoff.
#     Returns (ok, err_msg)
#     """
#     _ensure_bucket(bucket)  # ensure bucket exists :contentReference[oaicite:4]{index=4}
#     attempt = 0
#     while True:
#         attempt += 1
#         try:
#             _minio_client.put_object(
#                 bucket,
#                 object_name.lstrip("/"),
#                 io.BytesIO(content),
#                 length=len(content),
#                 content_type=content_type
#             )
#             return True, ""
#         except Exception as e:
#             if attempt >= max_attempts:
#                 return False, f"{type(e).__name__}: {e}"
#             time.sleep(base_delay * (2 ** (attempt - 1)))


def _halls_auth_headers() -> dict:
    raw = os.getenv("TICKGET_API_TOKEN") or os.getenv("HALLS_API_TOKEN")
    if not raw:
        logger.error("API token missing (TICKGET_API_TOKEN/HALLS_API_TOKEN).")
        raise HTTPException(status_code=502, detail="Authorization token not set (TICKGET_API_TOKEN or HALLS_API_TOKEN)")
    token = raw.strip()
    # 사전 로그
    logger.info("Auth header ready → scheme=Bearer token_len=%d", len(token))
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

async def _register_hall_and_get_id(name: str, total_seat: int) -> int:
    headers = _halls_auth_headers()
    payload = {"name": name, "totalSeat": total_seat}
    url = (HALLS_BASE_URL or "").strip().rstrip("/")

    # URL 빈값 방지 가드
    if not url:
        logger.error("HALLS_BASE_URL is empty!")
        raise HTTPException(status_code=500, detail="HALLS_BASE_URL is empty")

    # ---- httpx 이벤트 훅 (토큰 비노출) ----
    async def _on_request(request: httpx.Request):
        auth = request.headers.get("Authorization", "")
        logger.info(
            "Halls → %s %s | has_auth=%s auth_prefix=%s token_len=%s content_type=%s payload=%s",
            request.method, str(request.url),
            bool(auth),
            (auth.split()[0] if auth else None),
            (len(auth.split()[1]) if (auth and len(auth.split())>1) else 0),
            request.headers.get("Content-Type"),
            payload,
        )

    async def _on_response(response: httpx.Response):
        logger.info("Halls ← status=%s", response.status_code)
        if response.status_code // 100 != 2:
            snippet = (response.text or "")[:500]
            logger.warning("Halls non-2xx body_snippet=%s", snippet)

    try:
        t0 = time.perf_counter()
        async with httpx.AsyncClient(
            timeout=15.0,
            headers=headers,
            event_hooks={"request":[_on_request], "response":[_on_response]},
        ) as client:
            resp = await client.post(url, json=payload)
        dt = (time.perf_counter() - t0) * 1000
        logger.info("Halls done in %.1f ms", dt)

        resp.raise_for_status()
        data = resp.json()
        hall_id = data.get("hallId") or data.get("id")
        if hall_id is None:
            logger.error("Invalid Halls response (no hallId/id): %s", data)
            raise RuntimeError(f"Invalid halls response: {data}")
        logger.info("Halls OK → hallId=%s", hall_id)
        return hall_id
    except Exception as e:
        logger.exception("Halls register failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Halls register failed: {e}")
    
async def _finalize_and_publish(
    *,
    src_filename: str,
    capacity: int,
    tsx_bytes: bytes,
    meta_dict: dict,
    hall_name: Optional[str] = None,
    object_stem: Optional[str] = None,
) -> dict:
    """
    1) Halls 서비스에 등록 → hallId 획득
    2) MinIO에 TSX / meta.json 업로드 (재시도 + 로컬 폴백)
    3) 업로드 결과 리턴
    """
    logger.info(
        "Finalize&Publish start: src=%s capacity=%s hall_name=%s (tsx=%d bytes, meta_keys=%d)",
        src_filename, capacity, hall_name, len(tsx_bytes), len(meta_dict or {})
    )
    stem = (object_stem or "").strip() or os.path.splitext(src_filename)[0]
    hall_register_name = (hall_name or "").strip() or stem

    # 1) Halls 등록
    hall_id = await _register_hall_and_get_id(hall_register_name, capacity)

    # 2) MinIO 업로드(재시도) + 로컬 폴백
    tsx_key  = f"{stem}.tsx"
    meta_key = f"{stem}.meta.json"
    meta_bytes = json.dumps(meta_dict, ensure_ascii=False, indent=2).encode("utf-8")

    logger.info("Uploading to object-store… hallId=%s tsx_key=%s meta_key=%s", hall_id, tsx_key, meta_key)
    t1 = time.perf_counter()
    tsx_res  = save_bytes_to_object_store(tsx_bytes,  object_name=tsx_key,  hall_id=hall_id)
    meta_res = save_bytes_to_object_store(meta_bytes, object_name=meta_key, hall_id=hall_id)
    dt_up = (time.perf_counter() - t1) * 1000

    # 결과 요약 로그 (토큰/민감정보 없음)
    logger.info("Upload done (%.1f ms). TSX => ok=%s s3=%s local=%s | META => ok=%s s3=%s local=%s",
                dt_up,
                bool(tsx_res.get("ok")), tsx_res.get("s3"), tsx_res.get("local"),
                bool(meta_res.get("ok")), meta_res.get("s3"), meta_res.get("local"))

    # 3) 결과 구성
    result = {
        "hallId": hall_id,
        "minio": {
            "tsx":  tsx_res.get("s3"),
            "meta": meta_res.get("s3"),
        },
        "local": {
            "tsx":  tsx_res.get("local"),
            "meta": meta_res.get("local"),
        },
        "warn": [],
    }

    if not tsx_res.get("ok"):
        warn_msg = f"TSX S3 upload failed: {tsx_res.get('error')}"
        logger.warning(warn_msg)
        result["warn"].append(warn_msg)
    if not meta_res.get("ok"):
        warn_msg = f"META S3 upload failed: {meta_res.get('error')}"
        logger.warning(warn_msg)
        result["warn"].append(warn_msg)

    # 로컬 저장 성공여부 확인
    tsx_local_ok  = bool(tsx_res.get("local", {}).get("saved"))
    meta_local_ok = bool(meta_res.get("local", {}).get("saved"))
    logger.info("Local save status → tsx=%s meta=%s", tsx_local_ok, meta_local_ok)

    if (not tsx_local_ok) or (not meta_local_ok):
        logger.error("Local save failed for TSX/META (tsx_ok=%s, meta_ok=%s)", tsx_local_ok, meta_local_ok)
        raise HTTPException(status_code=500, detail="Local save failed for TSX/META")

    logger.info("Finalize&Publish OK → hallId=%s", hall_id)
    return result

# ----------------------------
# App & Routers
# ----------------------------

app = FastAPI(title="STH_v1 Modular FastAPI (B-plan + stage-fallback)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

@app.middleware("http")
async def log_request_timing(request: Request, call_next):
    start = time.perf_counter()
    start_ts = datetime.now().isoformat()
    logger.info("[REQ] %s %s start=%s", request.method, request.url.path, start_ts)
    response = None
    try:
        response = await call_next(request)
        return response
    finally:
        end_ts = datetime.now().isoformat()
        elapsed = (time.perf_counter() - start) * 1000
        status = response.status_code if response is not None else "error"
        logger.info("[REQ] %s %s done=%s elapsed=%.1fms status=%s",
                    request.method, request.url.path, end_ts, elapsed, status)

fg_router      = APIRouter(prefix="/fg", tags=["1. Foreground / Background"])
text_router    = APIRouter(prefix="/text", tags=["2. Text removal / Stage text"])
seg_router     = APIRouter(prefix="/segment", tags=["3. Segmentation"])
stage_router   = APIRouter(prefix="/stage", tags=["4. Stage center"])
analy_router   = APIRouter(prefix="/analyze", tags=["5. Gray/Mix & Grouping"])
assign_router  = APIRouter(prefix="/assign", tags=["6. Level/Capacity"])
render_router  = APIRouter(prefix="/render", tags=["7. Render"])
files_router   = APIRouter(prefix="/files", tags=["Files / Downloads"])
pipe_router    = APIRouter(prefix="/pipeline", tags=["Pipeline (integrated)"])

HALL_ID = 0

# ----------------------------
# Global knobs (B안 규칙)
# ----------------------------
COLOR_DELTA = 22.0

LAB_GRAY_Q  = 0.20
LAB_L_LOW   = 20.0
LAB_L_HIGH  = 245.0
BLACK_L_MAX = 35.0

TEXT_GRAY_RATIO_MIN = 0.60
TEXT_AREA_MAX       = 2000
TEXT_ASPECT_MIN     = 2.4


# OCR → STAGE 검출
# OCR configs removed
STAGE_KEYWORDS    = ["stage", "무대", "스테이지"]  # 정규화 후 포함 매칭
STAGE_OVERLAP_IOU = max(0.02, float(os.environ.get("STAGE_OVERLAP_IOU", "0.005")))  # 살짝만 겹쳐도 무대 강제 렌더
STAGE_DELE_THR    = 12.0    # ΔE 임계 (무대색 유사)

# 렌더 최소 면적
DEFAULT_MIN_RENDER_AREA = 450

# ----------------------------
# Fixed pipeline defaults
# ----------------------------
PIPELINE_DEFAULTS = {
    "crop_legend": False,
    "ensemble": True,
    "min_area": None,
    "iou_merge_thr": 0.42,
    "prefer_top_stage": True,
    "stage_cx": None,
    "stage_cy": None,
    "total_attendees": None,
    "quartiles": (0.20, 0.45, 0.75),
    "seats_per_component": 1,
    "neighbor_gap_px": 12,
    "gray_exclude_ratio": 0.55,
    "gray_chroma_quantile": LAB_GRAY_Q,
    "strong_gray_exclude": True,
    "min_render_area": DEFAULT_MIN_RENDER_AREA,
}

# ----------------------------
# Utils (color/geometry)
# ----------------------------

def with_ts(directory: Path, stem: str, tail: str) -> Path:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    return directory / f"{stem}_{ts}{tail}"

def to_hex(bgr):
    b, g, r = [int(x) for x in bgr]
    return "#{:02X}{:02X}{:02X}".format(r, g, b)

def wrap_html_as_tsx(html_str: str, comp_name: str = "SeatMap") -> bytes:
    # 최소한의 React TSX 컴포넌트 래핑
    # 필요하면 dangerouslySetInnerHTML 대신 svg/paths를 직접 TSX로 빌드하세요.
    tsx = f"""
import React from 'react';
export default function {comp_name}() {{
  return (
    <div dangerouslySetInnerHTML={{ __html: {json.dumps(html_str)} }} />
  );
}}
""".strip()
    return tsx.encode("utf-8")

def _extract_hall_id_from_json(obj: Any) -> Optional[str]:
    """
    다양한 래핑 케이스에서 hall id를 최대한 찾아냄.
    허용 키: id, hallId, hall_id
    래핑: data, result, hall, payload 등
    """
    if obj is None:
        return None
    if isinstance(obj, dict):
        # 1단계: 직통 키
        for k in ("id", "hallId", "hall_id"):
            if k in obj and obj[k]:
                return str(obj[k])

        # 2단계: 흔한 래핑 키들
        for wrap in ("data", "result", "hall", "payload", "content"):
            if wrap in obj:
                got = _extract_hall_id_from_json(obj[wrap])
                if got:
                    return got

        # 3단계: 배열 한 개만 담겨 오는 경우
        for k, v in obj.items():
            if isinstance(v, list) and v:
                got = _extract_hall_id_from_json(v[0])
                if got:
                    return got

    elif isinstance(obj, list) and obj:
        # 리스트 최상위인 경우
        got = _extract_hall_id_from_json(obj[0])
        if got:
            return got

    return None

def _nearest_square_grid(n: int) -> tuple[int, int]:
    """주어진 좌석 수 n을 최대한 정사각형에 가깝게 rows×cols로 배치"""
    if n <= 0:
        return (0, 0)
    cols = int(math.sqrt(n))
    if cols * cols < n:
        cols += 1
    rows = (n + cols - 1) // cols
    return int(rows), int(cols)

def build_sections_json(
    img_name: str,
    regions: list[dict],
    total_attendees: int | None,
    hall_name: str | None = None,
) -> dict:
    """
    요구사항:
      - 좌석 등급이 지정된(= grade가 있는) 폴리곤들의 넓이 합을 all_section_area_sum
      - 각 폴리곤: section_area, section_area_percent(%), component_count 계산
      - component_count로 정사각형에 가깝게 totalRows, totalCols 산출
      - 프론트로 보낼 sections JSON 구성
    참고:
      - 본 파이프라인에선 seat_level이 최종 등급명이므로 seat_grade에 매핑한다.
    """
    # 등급 필드 정규화: seat_grade <- seat_level
    for r in regions:
        if not r.get("seat_grade"):
            r["seat_grade"] = r.get("seat_level", "")

    graded = [r for r in regions if str(r.get("seat_grade", "")).strip() != ""]
    all_section_area_sum = float(sum(float(r.get("area", 0)) for r in graded)) or 1.0

    out_sections = []
    for r in graded:
        # 1) 면적/비율
        section_area = float(r.get("area", 0.0))
        section_area_percent = section_area / all_section_area_sum  # 0~1

        # 2) 좌석 수(컴포넌트 개수) = 총 수용인원 × 비율
        comp_cnt = 0
        if total_attendees and total_attendees > 0:
            comp_cnt = int(round(float(total_attendees) * section_area_percent))

        # 3) 그리드(rows, cols)
        totalRows, totalCols = _nearest_square_grid(comp_cnt)

        # 4) TSX data-attr에 다시 주입(선택)
        r["section_area"] = int(round(section_area))
        r["section_area_percent"] = float(round(section_area_percent * 100.0, 6))
        r["component_count"] = int(comp_cnt)
        r["totalRows"] = int(totalRows)
        r["totalCols"] = int(totalCols)

        # 5) 구역 id의 숫자부
        import re as _re
        rid = str(r.get("id",""))
        section_num = int(_re.sub(r"[^0-9]", "", rid) or "0")

        out_sections.append({
            "section": str(section_num),
            "grade": str(r.get("seat_grade","")),
            "totalRows": int(totalRows),
            "totalCols": int(totalCols),
            "seats": []
        })

    return {"name": hall_name or img_name, "sections": out_sections}

def kmeans_colors(X: np.ndarray, k: int = 2, attempts: int = 3):
    X = np.float32(X.reshape(-1, 3))
    if X.shape[0] < k:
        k = max(1, min(k, X.shape[0]))
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 80, 0.15)
    _compactness, labels, centers = cv2.kmeans(
        X, k, None, criteria, attempts, cv2.KMEANS_PP_CENTERS
    )
    return labels.reshape(-1), centers

def _signed_area2(pts: np.ndarray) -> float:
    """Shoelace signed area *2 (CW negative, CCW positive)."""
    x, y = pts[:, 0], pts[:, 1]
    return float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))

def polygon_area(pts):
    """Absolute area (for metrics)."""
    pts = np.asarray(pts, dtype=np.float32)
    return 0.5 * abs(_signed_area2(pts))

def polygon_centroid(pts) -> Tuple[float, float]:
    """
    Centroid with SIGNED area; robust to polygon orientation.
    Falls back to vertex mean when degenerate.
    """
    pts = np.asarray(pts, dtype=np.float64)
    A2 = _signed_area2(pts)  # signed area * 2
    if abs(A2) < 1e-6:
        return float(pts[:, 0].mean()), float(pts[:, 1].mean())
    x = pts[:, 0]; y = pts[:, 1]
    c = (x * np.roll(y, -1) - np.roll(x, -1) * y)
    cx = np.sum((x + np.roll(x, -1)) * c) / (3.0 * A2)
    cy = np.sum((y + np.roll(y, -1)) * c) / (3.0 * A2)
    return float(cx), float(cy)

def mask_from_polygon(h, w, poly):
    m = np.zeros((h, w), np.uint8)
    cv2.fillPoly(m, [np.int32(poly)], 255)
    return m

def iou_polygons(h, w, poly_a, poly_b):
    ma = mask_from_polygon(h, w, poly_a)
    mb = mask_from_polygon(h, w, poly_b)
    inter = cv2.countNonZero(cv2.bitwise_and(ma, mb))
    union = cv2.countNonZero(cv2.bitwise_or(ma, mb))
    return inter / union if union else 0.0

def _bbox_from_poly(poly):
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    return (min(xs), min(ys), max(xs), max(ys))

def _bbox_iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    ua = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter
    return inter / ua if ua else 0.0

def deltaE_lab(a, b):
    a = np.array(a, dtype=np.float32)
    b = np.array(b, dtype=np.float32)
    d = a - b
    return float(np.sqrt(np.sum(d * d)))

def _resolve_primary_stage_region(
    regions: List[Dict[str, Any]],
    stage_union_xywh: Optional[Tuple[int,int,int,int]],
    bgr: np.ndarray,
    *,
    iou_thr_bbox: float = 0.005
) -> Optional[str]:
    """
    stage_union_xywh (x,y,w,h)와 각 region bbox를 동일한 x1y1x2y2로 정규화해 IoU 최대인 폴리곤을 주 스테이지 후보로 반환.
    bbox가 이미 x1y1x2y2형으로 들어온 경우도 안전하게 처리한다.
    """
    if not stage_union_xywh:
        return None

    def _to_x1y1x2y2_from_any(box) -> Tuple[int,int,int,int]:
        # box가 (x,y,w,h) 형태면 변환, 이미 (x1,y1,x2,y2)이면 그대로
        x, y, w, h = [int(v) for v in box]
        if w <= 0 or h <= 0:
            # 이미 x1,y1,x2,y2로 들어온 케이스
            return int(x), int(y), int(w), int(h)
        return int(x), int(y), int(x + w), int(y + h)

    s_box = _to_x1y1x2y2_from_any(stage_union_xywh)

    best_id, best_iou = None, -1.0
    for r in regions:
        poly = r.get("polygon") or r.get("points")
        if not poly:
            continue
        bb = r.get("bbox")
        if bb is None:
            bb = _bbox_from_poly(poly)  # 이 함수가 (x1,y1,x2,y2)일 수도 있어 안전 변환 필요
        r_box = _to_x1y1x2y2_from_any(bb)

        iou = _bbox_iou(r_box, s_box)  # x1y1x2y2 기준 IoU
        if iou > best_iou:
            best_iou = iou
            best_id = r.get("id")

    return best_id if best_iou >= float(iou_thr_bbox) else None

# --- STAGE 기준점 유틸 ---

def _poly_bottom_center(points):
    xs = [p[0] for p in points]; ys = [p[1] for p in points]
    return int((min(xs) + max(xs)) / 2), int(max(ys))

def _find_stage_poly_from_rendered(regions):
    """
    렌더링에 남은 STAGE 폴리곤을 탐색.
    우선순위:
      1) is_stage / role/kind/label == stage
      2) name/text에 'stage' 포함
      3) 상단 40%·회색톤·non_interactive 큰 폴리곤
    """
    # 1) 명시 플래그
    for r in regions:
        if r.get("render", 1) != 0 and (r.get("polygon") or r.get("points")):
            if r.get("is_stage"): return r
            role = str(r.get("role","")).lower()
            kind = str(r.get("kind","")).lower()
            label= str(r.get("label","")).lower()
            if role == "stage" or kind == "stage" or label == "stage":
                return r
    # 2) name/text
    cands = []
    for r in regions:
        if r.get("render", 1) != 0:
            pts = r.get("polygon") or r.get("points")
            if not pts: continue
            txt = (str(r.get("name","")) + " " + str(r.get("text",""))).lower()
            if "stage" in txt:
                cands.append(r)
    if cands:
        cands.sort(key=lambda rr: (
            min(p[1] for p in (rr.get("polygon") or rr.get("points"))),
            -float(rr.get("area", 0))
        ))
        return cands[0]

    # 3) 마지막 후보: 상단 40%·회색톤·non_interactive 큰 폴리곤
    try:
        H = max((max(p[1] for p in (r.get("polygon") or r.get("points")))
                 for r in regions if (r.get("polygon") or r.get("points"))), default=0) or 0
        top_cut = 0.40 * H
        def is_grayish_hex(hx):
            try:
                v = int(str(hx).lstrip("#"), 16)
                r = (v >> 16) & 0xff; g = (v >> 8) & 0xff; b = v & 0xff
                return (max(r,g,b) - min(r,g,b)) <= 18
            except: return False
        gc = []
        for r in regions:
            if r.get("render", 1) == 0: continue
            pts = r.get("polygon") or r.get("points")
            if not pts: continue
            if int(r.get("non_interactive", 0)) != 1: continue
            if not is_grayish_hex(r.get("fill_hex", r.get("fill", "#000000"))): continue
            ys = [p[1] for p in pts]
            if (sum(ys)/len(ys)) <= top_cut:
                gc.append(r)
        if gc:
            gc.sort(key=lambda rr: -float(rr.get("area", 0)))
            return gc[0]
    except:
        pass
    return None

def stage_reference_point(stage_union_xywh, fallback_center):
    """STAGE bbox bottom-center. 없으면 fallback center."""
    if not stage_union_xywh:
        return int(fallback_center[0]), int(fallback_center[1])
    x, y, w, h = [int(v) for v in stage_union_xywh]
    return int(x + w/2), int(y + h)

def _ocr_base_url() -> str:
    # 환경변수로 바꿀 수 있게: OCR_URL=http://localhost:8100
    return ""

def _inject_synthetic_stage_region(
    regions: List[Dict[str, Any]],
    stage_union_xywh: Optional[Tuple[int,int,int,int]],
    *,
    fill_hex: str = "#1A1A1A"
) -> None:
    """
    OCR/휴리스틱으로 얻은 stage_union_xywh로 'poly_STAGE'를 항상 한 장 주입.
    렌더시 최상단(마지막)으로 그리도록 force_render_stage=True와 zprio를 준다.
    """
    if not stage_union_xywh:
        return
    sx, sy, sw, sh = stage_union_xywh
    if sw <= 0 or sh <= 0:
        return

    # 이미 poly_STAGE가 있으면 중복 주입 금지
    if any(str(r.get("id","")).startswith("poly_STAGE") for r in regions):
        return

    poly = [(sx,sy), (sx+sw,sy), (sx+sw,sy+sh), (sx,sy+sh)]
    regions.append({
        "id": "poly_STAGE",
        "polygon": poly,
        "fill": fill_hex,
        "area": float(sw*sh),
        "label": "STAGE",
        "role": "stage",
        "kind": "stage",
        "seat_grade": "",
        "non_interactive": 1,
        "non_interactive_stage": True,
        "force_render_stage": True,
        "exclude_from_level": True,
        # 렌더 정렬 힌트(있으면 사용)
        "zprio": 10_000
    })

# ----------------------------
# Auto / thresholds
# ----------------------------

# --- canonical estimate_gray_thresholds (drop-in for BOTH files) ---
def estimate_gray_thresholds(
    img_bgr: Optional[np.ndarray],
    q: float = 0.20,          # LAB_GRAY_Q 대체 (20퍼센타일)
    L_low: float = 20.0,      # 어두운 회색 하한
    L_high: float = 245.0,    # 밝은 회색 상한
) -> Dict[str, float]:
    """
    LAB에서 a,b 편차로 chroma(채도)에 대한 분위값 기반 임계치를 잡고,
    회색 판정에 쓸 L(명도) 범위를 함께 리턴한다.
    - 리턴키: {"chroma_thr": float, "L_low": float, "L_high": float}
    - img_bgr가 None/빈배열이면 합리적 기본값으로 폴백.
    """
    # 폴백: 이미지가 없거나 비정상이면 안전한 기본값
    if img_bgr is None or not hasattr(img_bgr, "shape") or img_bgr.size == 0:
        return {"chroma_thr": 12.0, "L_low": float(L_low), "L_high": float(L_high)}

    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    a = np.abs(lab[:, :, 1] - 128.0)
    b = np.abs(lab[:, :, 2] - 128.0)
    chroma = np.sqrt(a * a + b * b)

    # 분위 기반 + 살짝 여유 ( +3.0 )
    chroma_thr = float(np.quantile(chroma.reshape(-1), q)) + 6.0
    return {"chroma_thr": chroma_thr, "L_low": float(L_low), "L_high": float(L_high)}

def is_gray_lab(lab_px: np.ndarray, chroma_thr: float, L_low: float, L_high: float) -> np.ndarray:
    a = np.abs(lab_px[:, :, 1] - 128.0)
    b = np.abs(lab_px[:, :, 2] - 128.0)
    chroma = np.sqrt(a * a + b * b)
    L = lab_px[:, :, 0]
    return (chroma <= chroma_thr) & (L >= L_low) & (L <= L_high)

def lab_is_gray_vec(lab_vec: List[float], chroma_thr: float, L_low: float, L_high: float) -> bool:
    L, a, b = float(lab_vec[0]), float(lab_vec[1]), float(lab_vec[2])
    chroma = math.hypot(a - 128.0, b - 128.0)
    return (chroma <= chroma_thr) and (L >= L_low) and (L <= L_high)

def lab_is_black_vec(lab_vec: List[float]) -> bool:
    L = float(lab_vec[0])
    return (L <= BLACK_L_MAX)

# ----------------------------
# Foreground / background / text
# ----------------------------

def global_bg_mask(img_bgr: np.ndarray, k: int = 5) -> np.ndarray:
    h, w = img_bgr.shape[:2]
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    sample = cv2.resize(lab, (max(2, w // 2), max(2, h // 2)), interpolation=cv2.INTER_AREA).reshape(-1, 3)
    _lbls_small, ctrs = kmeans_colors(sample, k=k, attempts=5)
    dists = [np.linalg.norm(lab.astype(np.float32) - c, axis=-1) for c in ctrs]
    labels_full = np.stack(dists, -1).argmin(axis=-1).astype(np.int32)

    counts = np.bincount(labels_full.reshape(-1), minlength=k)
    bg_idx = int(np.argmax(counts))

    mask_bg = (labels_full == bg_idx).astype(np.uint8) * 255
    fg_mask = cv2.bitwise_not(mask_bg)
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
    return fg_mask

def text_mask_mser(img_bgr: np.ndarray, fg_mask: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    mser = cv2.MSER_create()
    mser.setMinArea(35)
    mser.setMaxArea(4000)
    regions, _ = mser.detectRegions(gray)
    mask = np.zeros_like(gray, np.uint8)
    for pts in regions:
        hull = cv2.convexHull(pts.reshape(-1, 1, 2))
        cv2.drawContours(mask, [hull], -1, 255, -1)
    edges = cv2.Canny(gray, 40, 120)
    mask = np.maximum(mask, cv2.dilate(edges, np.ones((2, 2), np.uint8), 1))
    mask = cv2.bitwise_and(mask, fg_mask)
    return mask

def inpaint_soft(img_bgr: np.ndarray, mask: np.ndarray) -> np.ndarray:
    if cv2.countNonZero(mask) == 0:
        return img_bgr.copy()
    shr = cv2.morphologyEx(mask, cv2.MORPH_ERODE, np.ones((2, 2), np.uint8), iterations=1)
    return cv2.inpaint(img_bgr, shr, 2, cv2.INPAINT_TELEA)

# ----------------------------
# Stage text & center
# ----------------------------

def _make_stage_templates():
    texts = ["STAGE", "Stage", "stage"]
    fonts = [cv2.FONT_HERSHEY_SIMPLEX, cv2.FONT_HERSHEY_DUPLEX]
    # 큰 글자까지 커버
    scales = [0.9, 1.1, 1.3, 1.6, 2.0, 2.4, 2.8, 3.2]
    tmpls = []
    for t in texts:
        for ft in fonts:
            for s in scales:
                img = np.full((120, 800), 255, np.uint8)
                (w, h), _ = cv2.getTextSize(t, ft, s, 2)
                x = max(0, (img.shape[1] - w) // 2)
                y = max(h + 5, (img.shape[0] + h) // 2)
                cv2.putText(img, t, (x, y), ft, s, 0, 2, cv2.LINE_AA)
                ys, xs = np.where(img < 250)
                if len(xs) == 0 or len(ys) == 0:
                    continue
                x1, x2 = xs.min(), xs.max()
                y1, y2 = ys.min(), ys.max()
                tmpls.append(img[y1:y2 + 1, x1:x2 + 1])
    return tmpls

_STAGE_TEMPLATES = _make_stage_templates()

def detect_stage_text_center(
    img_bgr: np.ndarray,
    *,
    prefer_top_stage: bool = True,
    stage_cx: Optional[int] = None,
    stage_cy: Optional[int] = None,
) -> Optional[Tuple[int, int]]:
    """스테이지 텍스트/패턴 중심 좌표를 추정."""
    if stage_cx is not None and stage_cy is not None:
        return (int(stage_cx), int(stage_cy))

    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    best_center: Optional[Tuple[int, int]] = None
    best_score: float = -1.0

    y_top_limit = int(h * 0.50) if prefer_top_stage else h

    for tmpl in _STAGE_TEMPLATES:
        th, tw = tmpl.shape[:2]
        if th >= h or tw >= w:
            continue

        for cand in (tmpl, 255 - tmpl):
            res = cv2.matchTemplate(gray, cand, cv2.TM_CCOEFF_NORMED)
            _, maxV, _, maxL = cv2.minMaxLoc(res)
            cx = maxL[0] + tw // 2
            cy = maxL[1] + th // 2

            # ⑤ 가로 중앙 가산점(정확히는 중앙에서 멀수록 감점)
            center_penalty = 0.12 * (abs(cx - (w / 2)) / max(1, w))

            if prefer_top_stage and cy > y_top_limit:
                eff = maxV - 0.08 - center_penalty
            else:
                eff = maxV - 0.06 * (cy / max(1, h)) - center_penalty

            if eff > best_score:
                best_center = (cx, cy)
                best_score = eff

    # 기존 느슨한 임계치 유지 (0.48 - 0.06)
    if best_center is not None and best_score >= 0.42:
        return (int(best_center[0]), int(best_center[1]))
    return None

def _fallback_stage_from_gray(bgr: np.ndarray) -> Optional[Tuple[int,int,int,int]]:
    H, W = bgr.shape[:2]
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    thr = estimate_gray_thresholds(bgr)
    g = is_gray_lab(lab, thr["chroma_thr"]+2.0, thr["L_low"], thr["L_high"]).astype(np.uint8)*255
    g = cv2.morphologyEx(g, cv2.MORPH_CLOSE, np.ones((7,7),np.uint8), 2)

    cnts, _ = cv2.findContours(g, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts: return None

    cand = sorted(
        cnts,
        key=lambda c: (cv2.contourArea(c), cv2.boundingRect(c)[2]/max(1,cv2.boundingRect(c)[3])),
        reverse=True
    )
    for c in cand:
        x,y,w,h = cv2.boundingRect(c)
        area = w*h
        asp  = w/max(1,h)
        if area >= 0.005*W*H and asp >= 2.0:
            return (x,y,w,h)
    return None

def estimate_stage_center(img_bgr: np.ndarray, prefer_top_stage: bool = True) -> Tuple[int, int]:
    c = detect_stage_text_center(img_bgr, prefer_top_stage=prefer_top_stage)
    if c is not None:
        return c
    h, w = img_bgr.shape[:2]
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    thr = estimate_gray_thresholds(img_bgr)
    graymask = is_gray_lab(lab, thr["chroma_thr"] + 2.0, thr["L_low"], thr["L_high"]).astype(np.uint8) * 255
    cand = graymask
    top = cand[0:int(h * 0.45), :] if prefer_top_stage else cand
    cnts, _ = cv2.findContours(top, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if cnts:
        c = max(cnts, key=cv2.contourArea)
        M = cv2.moments(c)
        if M["m00"] > 0:
            cx = int(M["m10"] / M["m00"]); cy = int(M["m01"] / M["m00"])
            return (cx, cy)
    return (img_bgr.shape[1] // 2, int(img_bgr.shape[0] * 0.10))

# --- NEW: STAGE 텍스트 '배경색' 샘플링 도우미 ------------------------------
def _median_lab_in_mask(bgr: np.ndarray, mask: np.ndarray) -> Optional[np.ndarray]:
    if mask is None or mask.sum() < 16:
        return None
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    pix = lab[mask.astype(bool)]
    if pix.size < 9:
        return None
    return np.median(pix, axis=0)

def _inflate_box(x,y,w,h, dx,dy, W,H):
    nx = max(0, x - dx); ny = max(0, y - dy)
    nw = min(W - nx, w + 2*dx); nh = min(H - ny, h + 2*dy)
    return nx, ny, nw, nh

def _ring_mask_around_box(H,W, x,y,w,h, inner=2, outer=8) -> np.ndarray:
    m = np.zeros((H,W), np.uint8)
    x0,y0,w0,h0 = _inflate_box(x,y,w,h, outer,outer, W,H)
    x1,y1,w1,h1 = _inflate_box(x,y,w,h, inner,inner, W,H)
    cv2.rectangle(m, (x0,y0), (x0+w0-1, y0+h0-1), 255, thickness=-1)
    cv2.rectangle(m, (x1,y1), (x1+w1-1, y1+h1-1), 0,   thickness=-1)
    return m

def sample_stage_bg_color(
    bgr: np.ndarray,
    stage_union_xywh: Optional[Tuple[int,int,int,int]],
) -> Optional[Dict[str,Any]]:
    """
    우선순위:
      1) 'STAGE/무대/스테이지' 문자열 bbox 주변 링(ring)에서 배경색 샘플
      2) (1)이 없으면 stage_union 박스 주변 링에서 샘플
    반환: {"lab_med": np.array([L,a,b],float32), "hex": "#RRGGBB"}
    """
    return None
    cand_boxes = []
    if False:
        for ln in ocr_lines_norm:
            txt = str(ln.get("text","")).lower()
            if any(k in txt for k in ("stage","무대","스테이지")):
                # line bbox (cx,cy,w,h) or (x,y,w,h) 지원
                if "x" in ln:
                    x,y,w,h = int(ln["x"]), int(ln["y"]), int(ln["w"]), int(ln["h"])
                else:
                    cx,cy = int(ln.get("cx",0)), int(ln.get("cy",0))
                    w = int(ln.get("w", max(8, W//20))); h = int(ln.get("h", max(6, H//25)))
                    x = max(0, cx - w//2); y = max(0, cy - h//2)
                cand_boxes.append((x,y,w,h))
    if (not cand_boxes) and stage_union_xywh:
        cand_boxes.append(stage_union_xywh)

    best = None
    for (x,y,w,h) in cand_boxes:
        ring = _ring_mask_around_box(H,W,x,y,w,h, inner=3, outer=10)
        lab = _median_lab_in_mask(bgr, ring)
        if lab is not None:
            best = lab; break
    if best is None:
        return None

    bgr1 = cv2.cvtColor(best.astype(np.uint8).reshape(1,1,3), cv2.COLOR_Lab2BGR).reshape(-1)
    hexv = f'#{int(bgr1[2]):02X}{int(bgr1[1]):02X}{int(bgr1[0]):02X}'
    return {"lab_med": best, "hex": hexv}

def _to_x1y1x2y2(box_xywh):
    x, y, w, h = [int(v) for v in box_xywh]
    return (x, y, x + w, y + h)

# ----------------------------
# Region extraction
# ----------------------------

def _regions_from_mask(color_bgr: np.ndarray, mask: np.ndarray, min_area: int) -> List[Dict[str, Any]]:
    h, w = mask.shape[:2]
    num, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    out = []
    for i in range(1, num):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < min_area:
            continue
        x, y, ww, hh = [int(v) for v in stats[i, :4]]
        roi = (labels[y:y + hh, x:x + ww] == i).astype(np.uint8) * 255
        cnts, _ = cv2.findContours(roi, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not cnts:
            continue
        c = max(cnts, key=cv2.contourArea)
        a = cv2.contourArea(c)
        if a < min_area:
            continue
        eps = 0.012 * cv2.arcLength(c, True)
        poly = (cv2.approxPolyDP(c, eps, True).reshape(-1, 2) + np.array([x, y])).tolist()
        poly_np = np.array(poly, np.int32)
        bx, by, bw, bh = cv2.boundingRect(poly_np)
        cx, cy = polygon_centroid(poly)

        mfull = np.zeros((h, w), np.uint8)
        cv2.drawContours(mfull, [c + [x, y]], -1, 255, -1)
        interior = cv2.erode(mfull, np.ones((3, 3), np.uint8), 1)
        if cv2.countNonZero(interior) < 40:
            interior = mfull
        pts = color_bgr[interior > 0].reshape(-1, 3)

        if len(pts) == 0:
            fill_hex = "#CCCCCC"; med_lab_list = [0.0, 0.0, 0.0]
        else:
            lab_pts = cv2.cvtColor(pts.reshape(-1, 1, 3), cv2.COLOR_BGR2LAB).reshape(-1, 3)
            med_lab = np.median(lab_pts, axis=0).astype(np.float32)
            med_lab_list = [float(med_lab[0]), float(med_lab[1]), float(med_lab[2])]
            med_bgr = cv2.cvtColor(med_lab.astype(np.uint8).reshape(1, 1, 3), cv2.COLOR_Lab2BGR).reshape(3, )
            fill_hex = to_hex(med_bgr)

        out.append({
            "id": None,
            "polygon": poly,
            "bbox": [int(bx), int(by), int(bw), int(bh)],
            "centroid": [cx, cy],
            "area": float(a),
            "perimeter": float(cv2.arcLength(poly_np, True)),
            "fill": fill_hex,
            "lab_med": med_lab_list,
            "two_color_mix": None
        })
    for i, r in enumerate(out):
        r["id"] = "poly_{:04d}".format(i + 1)
    return out

# ----------------------------
# Segmentors
# ----------------------------
def seg_conncomp(no_text_bgr: np.ndarray, fg_mask: np.ndarray, min_area: int, color_bgr: np.ndarray) -> List[Dict[str, Any]]:
    mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), 1)
    return _regions_from_mask(color_bgr, mask, min_area)

def seg_slic(no_text_bgr: np.ndarray, fg_mask: np.ndarray, min_area: int, deltaE_merge: float, color_bgr: np.ndarray) -> List[Dict[str, Any]]:
    h, w = fg_mask.shape[:2]
    step = max(8, int(min(h, w) * 0.02))
    labels = np.zeros((h, w), np.int32)
    lbl = 1
    for y in range(0, h, step):
        for x in range(0, w, step):
            y2 = min(h, y + step); x2 = min(w, x + step)
            labels[y:y2, x:x2] = lbl; lbl += 1
    lab = cv2.cvtColor(no_text_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    centers = {}
    for k in range(1, lbl):
        m = (labels == k) & (fg_mask > 0)
        if not np.any(m):
            continue
        centers[k] = np.mean(lab[m], axis=0)
    parent = {k: k for k in centers.keys()}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    keys = list(centers.keys())
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            a, b = keys[i], keys[j]
            if deltaE_lab(centers[a], centers[b]) <= deltaE_merge:
                union(a, b)
    remap = {}
    nid = 1
    for k in range(1, lbl):
        if k not in centers:
            continue
        root = find(k)
        if root not in remap:
            remap[root] = nid; nid += 1
        labels[labels == k] = remap[root]
    labels = labels * (fg_mask > 0)
    return _regions_from_mask(color_bgr, (labels > 0).astype(np.uint8) * 255, min_area)

def seg_watershed(no_text_bgr: np.ndarray, fg_mask: np.ndarray, min_area: int, color_bgr: np.ndarray) -> List[Dict[str, Any]]:
    gray = cv2.cvtColor(no_text_bgr, cv2.COLOR_BGR2GRAY)
    thr = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    thr = cv2.bitwise_and(thr, fg_mask)
    dist = cv2.distanceTransform(thr, cv2.DIST_L2, 5)
    _, sure = cv2.threshold(dist, 0.35 * dist.max(), 255, 0)
    sure = sure.astype(np.uint8)
    unk = cv2.subtract(thr, sure)
    num, markers = cv2.connectedComponents(sure)
    markers = markers + 1
    markers[unk == 255] = 0
    ws = cv2.watershed(no_text_bgr.copy(), markers)
    mask = (ws > 1).astype(np.uint8) * 255
    mask = cv2.bitwise_and(mask, fg_mask)
    return _regions_from_mask(color_bgr, mask, min_area)

def merge_ensemble(
    h: int,
    w: int,
    lists: List[List[Dict[str, Any]]],
    iou_thr: float = 0.65,
    iou_merge_thr: float | None = None,
) -> List[Dict[str, Any]]:
    if iou_merge_thr is not None:
        iou_thr = iou_merge_thr
    all_regs = []
    for L in lists:
        all_regs.extend(L)
    used = [False] * len(all_regs)
    out: List[Dict[str, Any]] = []
    bbox_cache = [_bbox_from_poly(r["polygon"]) for r in all_regs]

    med_area = None
    if all_regs:
        areas = [r["area"] for r in all_regs]
        med_area = float(np.median(areas))

    for i, ri in enumerate(all_regs):
        if used[i]:
            continue
        votes = 1
        group = [i]
        for j in range(i + 1, len(all_regs)):
            if used[j]:
                continue
            if _bbox_iou(bbox_cache[i], bbox_cache[j]) < 0.10:
                continue
            if iou_polygons(h, w, ri["polygon"], all_regs[j]["polygon"]) >= iou_thr:
                votes += 1; group.append(j)
        if votes >= 2:
            k = max(group, key=lambda idx: all_regs[idx]["area"])
            out.append(all_regs[k])
            for idx in group:
                used[idx] = True

    for i, ri in enumerate(all_regs):
        if not used[i] and ((ri["area"] > 1.5 * (med_area or 0))) :
            out.append(ri)
    for i, r in enumerate(out):
        r["id"] = "poly_{:04d}".format(i + 1)
    return out

# ----------------------------
# Grouping / Grades
# ----------------------------

def compute_neighbors(regions: List[Dict[str, Any]], px_gap: int = 12) -> Dict[str, List[str]]:
    """
    각 폴리곤의 bbox를 기준으로, px_gap 만큼 확장한 사각형들이 서로 겹치면 이웃으로 간주.
    bbox가 없는 region은 polygon으로부터 bbox를 생성한다.
    """
    from collections import defaultdict

    def _bbox_from_polygon(poly: List[Tuple[int, int]]) -> Tuple[int, int, int, int]:
        if not poly:
            return (0, 0, 0, 0)
        xs = [int(p[0]) for p in poly]
        ys = [int(p[1]) for p in poly]
        x0, y0 = min(xs), min(ys)
        x1, y1 = max(xs), max(ys)
        return (x0, y0, max(0, x1 - x0), max(0, y1 - y0))

    def _expand_box(b: Tuple[int, int, int, int], g: int) -> Tuple[int, int, int, int]:
        x, y, w, h = b
        return (x - g, y - g, w + 2 * g, h + 2 * g)

    def _intersects(a: Tuple[int, int, int, int], b: Tuple[int, int, int, int]) -> bool:
        ax, ay, aw, ah = a
        bx, by, bw, bh = b
        if aw <= 0 or ah <= 0 or bw <= 0 or bh <= 0:
            return False
        ax2, ay2 = ax + aw, ay + ah
        bx2, by2 = bx + bw, by + bh
        return not (ax2 <= bx or bx2 <= ax or ay2 <= by or by2 <= ay)

    gap = max(0, int(px_gap))
    boxes: Dict[str, Tuple[int, int, int, int]] = {}
    ids: List[str] = []

    # 1) 모든 region에 bbox 보장
    for r in regions:
        rid = str(r.get("id", ""))
        if not rid:
            continue
        ids.append(rid)

        if "bbox" in r and r.get("bbox") not in (None, [], ()):
            x, y, w, h = r["bbox"]
            x, y, w, h = int(x), int(y), int(w), int(h)
        else:
            # polygon으로부터 bbox 생성
            poly = r.get("polygon") or []
            x, y, w, h = _bbox_from_polygon(poly)
            r["bbox"] = [x, y, w, h]  # 저장해 두면 이후 단계도 안전

        boxes[rid] = (x, y, w, h)

    # 2) 격자형 인덱스 없이도 N^2가 크게 부담 아닐 수준이면 간단히 스캔
    neigh: Dict[str, List[str]] = defaultdict(list)
    n = len(ids)
    for i in range(n):
        ri = ids[i]
        ai = _expand_box(boxes[ri], gap)
        for j in range(i + 1, n):
            rj = ids[j]
            bj = _expand_box(boxes[rj], gap)
            if _intersects(ai, bj):
                neigh[ri].append(rj)
                neigh[rj].append(ri)

    # 3) 없는 키도 빈 리스트로 보장
    for rid in ids:
        neigh.setdefault(rid, [])

    return dict(neigh)

def cluster_by_color(regions: List[Dict[str, Any]], thr: float) -> Dict[str, int]:
    centers: List[List[float]] = []
    groups: Dict[str, int] = {}
    for r in regions:
        lab = r.get("lab_for_group") or r.get("lab_med") or [0.0, 0.0, 0.0]
        assigned = False
        for gi, c in enumerate(centers):
            if deltaE_lab(lab, c) <= thr:
                groups[r["id"]] = gi
                assigned = True
                break
        if not assigned:
            centers.append(lab)
            groups[r["id"]] = len(centers) - 1
    return groups

def _color_group_summary(regions: List[Dict[str, Any]]):
    buckets: Dict[int, Dict[str, Any]] = {}
    for r in regions:
        g = int(r.get("color_group", -1))
        if g < 0:
            continue
        buckets.setdefault(g, {"dists": [], "labs": [], "count": 0})
        buckets[g]["count"] += 1
        buckets[g]["dists"].append(float(r.get("distance_to_stage", 0.0)))
        buckets[g]["labs"].append(np.array(r.get("lab_med", [0, 0, 0]), dtype=np.float32))
    summary = []
    for g, v in buckets.items():
        mean_dist = float(np.mean(v["dists"])) if v["dists"] else 0.0
        mean_lab = np.mean(np.stack(v["labs"]), axis=0) if v["labs"] else np.array([0, 0, 0], dtype=np.float32)
        bgr = cv2.cvtColor(mean_lab.astype(np.uint8).reshape(1, 1, 3), cv2.COLOR_Lab2BGR).reshape(3, )
        summary.append({
            "group": int(g),
            "count": int(v["count"]),
            "mean_distance": round(mean_dist, 2),
            "mean_lab": [float(mean_lab[0]), float(mean_lab[1]), float(mean_lab[2])],
            "repr_hex": to_hex(bgr)
        })
    summary.sort(key=lambda x: x["mean_distance"])
    return summary

def _map_level_names_by_group_count(sorted_group_ids: List[int]) -> Dict[int, str]:
    n = len(sorted_group_ids)
    if n == 1:
        names = ["R"]
    elif n == 2:
        names = ["VIP", "R"]
    elif n == 3:
        names = ["VIP", "R", "S"]
    else:
        names = ["STANDING", "VIP", "R", "S"]
    mapping = {}
    for i, g in enumerate(sorted_group_ids):
        mapping[g] = names[min(i, len(names) - 1)]
    return mapping

def assign_levels_and_capacity(
    regions: List[Dict[str, Any]],
    stage_center: Tuple[int, int],
    total_attendees: Optional[int],
    quartiles: Tuple[float, float, float],
    seats_per_component: int,
    *,
    color_delta: float = COLOR_DELTA,
    exclude_gray_ids: Optional[set] = None,  # (보존: 외부에서 강제 제외하려면 사용)
    neighbor_gap_px: int = 12,
) -> None:
    """
    좌석 등급(grade) 산정 규칙 (최종판)
    1) 같은 '색상 그룹(color_group)' = 같은 grade (그룹 단위 배정).
    2) STAGE 기준점(중앙 하단)과의 '평균 거리'가 가까운 색상 그룹부터 등급 부여.
       그룹 수에 따라:
         1개: [R]
         2개: [VIP, R]
         3개: [VIP, R, S]
         4개+: [STANDING, VIP, R, S]
    3) 등급 부여 대상(valid_regs)은 좌석 후보만(무대/텍스트/회색/검정/무대겹침 제외).
    4) '순서 계산'(그룹 평균거리 산출)은 valid_regs + 무대겹침(non_interactive_stage) 좌석까지 포함해 표본 편향을 완화.
    5) ring_index는 표시/진단용이며 grade에는 영향 없음.
    6) capacity/component_count는 area 비율로 분배.
    """
    sx, sy = stage_center

    # --- 0) 거리/이웃 메타 ---
    def _safe_centroid(r: Dict[str, Any]) -> Tuple[float, float]:
        pts = np.asarray(r["polygon"], dtype=np.float64)
        cx, cy = polygon_centroid(pts)
        x0,y0 = float(pts[:,0].min()), float(pts[:,1].min())
        x1,y1 = float(pts[:,0].max()), float(pts[:,1].max())
        if not (x0-1e-3 <= cx <= x1+1e-3 and y0-1e-3 <= cy <= y1+1e-3):
            cx, cy = float(pts[:,0].mean()), float(pts[:,1].mean())
        return float(cx), float(cy)

    for r in regions:
        cx, cy = r.get("centroid", (None, None))
        if (cx is None) or (cy is None) or (not np.isfinite(cx)) or (not np.isfinite(cy)) or (cx < 0) or (cy < 0):
            cx, cy = _safe_centroid(r)
            r["centroid"] = [cx, cy]
        r["distance_to_stage"] = float(math.hypot(r["centroid"][0] - sx, r["centroid"][1] - sy))

    neigh = compute_neighbors(regions, px_gap=max(2, neighbor_gap_px))
    for r in regions:
        r["neighbors"] = neigh[r["id"]]

    # --- 1) 등급 부여 대상(좌석 후보) 필터 ---
    def _eligible_for_grading(rr):
        # 외부 강제 제외(옵션)
        if exclude_gray_ids and rr["id"] in exclude_gray_ids:
            return False
        # 무대/플레이스홀더는 제외 (진짜 STAGE만)
        if rr.get("force_render_stage"):
            return False
        if str(rr.get("role","")).lower() == "stage":
            return False
        if str(rr.get("kind","")).lower() == "stage":
            return False
        if str(rr.get("label","")).upper() == "STAGE":
            return False
        if str(rr.get("id","")).startswith("poly_STAGE"):
            return False

        # 텍스트/회색/검정 제외 (렌더 정책과 정합)
        if rr.get("is_textish", False):
            return False
        # ⛔ 기존: 회색/검정은 제외
        if rr.get("is_gray", False) or rr.get("is_black", False):
            # ✅ 예외: 실제 채움색이 충분히 '유채색'이면(=크로마가 높으면) 회색 오검출로 간주하고 살린다.
            lab_vec = rr.get("lab_med") or rr.get("lab_for_group")
            if lab_vec is not None:
                L, a, b = float(lab_vec[0]), float(lab_vec[1]), float(lab_vec[2])
                chroma = ( (a - 128.0)**2 + (b - 128.0)**2 )**0.5
                # 임계값은 살짝 느슨하게(기존 gray 판정보다 1.3~1.5배 여유)
                if chroma >= 1.35 * COLOR_DELTA:
                    pass  # 유채색으로 인정 → 제외하지 않음
                else:
                    return False
            else:
                return False

        if float(rr.get("area", 0.0)) <= 0.0:
            return False
        return True


    valid_regs = [r for r in regions if _eligible_for_grading(r)]

    # --- 2) '순서 계산' 표본: 좌석 후보 + 무대겹침 좌석(색상/좌석형만) ---
    def _eligible_for_order(rr: Dict[str, Any]) -> bool:
        # STAGE 류 제외
        if rr.get("force_render_stage"): return False
        if str(rr.get("role","")).lower() == "stage": return False
        if str(rr.get("kind","")).lower() == "stage": return False
        if str(rr.get("label","")).upper() == "STAGE": return False
        if str(rr.get("id","")).startswith("poly_STAGE"): return False

        # 텍스트 제외
        if rr.get("is_textish", False): return False

        # ⚠ 회색/검정이라도 '채도(크로마) 높으면' 예외로 포함 (grading과 동일 규칙)
        if rr.get("is_gray", False) or rr.get("is_black", False):
            lab_vec = rr.get("lab_med") or rr.get("lab_for_group")
            if lab_vec is None:
                return False
            # LAB 기준 크로마: sqrt((a-128)^2 + (b-128)^2)
            a, b = float(lab_vec[1]), float(lab_vec[2])
            chroma = ((a - 128.0)**2 + (b - 128.0)**2) ** 0.5
            if chroma < 1.35 * COLOR_DELTA:
                return False  # 진짜 무채색이면 제외

        # 면적 컷
        if float(rr.get("area", 0.0)) <= 0.0:
            return False

        return True

    order_regs = [r for r in regions if _eligible_for_order(r)]

    # --- 3) 색상 그룹: grading+order의 합집합을 클러스터링 입력 ---
    union_dict: Dict[str, Dict[str, Any]] = {}
    for rr in valid_regs:
        union_dict[rr["id"]] = rr
    for rr in order_regs:
        union_dict.setdefault(rr["id"], rr)
    cluster_input = list(union_dict.values())

    color_groups: Dict[str, int] = cluster_by_color(cluster_input, color_delta)
    for r in regions:
        r["color_group"] = int(color_groups.get(r["id"], -1))

    # --- 4) 그룹별 거리 리스트(등급/순서 분리) ---
    from collections import defaultdict
    by_group_for_grade: Dict[int, List[float]] = defaultdict(list)
    for r in valid_regs:
        g = int(r.get("color_group", -1))
        if g >= 0:
            by_group_for_grade[g].append(float(r["distance_to_stage"]))

    by_group_for_order: Dict[int, List[float]] = defaultdict(list)
    for r in order_regs:
        g = int(r.get("color_group", -1))
        if g >= 0:
            by_group_for_order[g].append(float(r["distance_to_stage"]))

    if not by_group_for_grade:
        area_sum = float(sum(r["area"] for r in valid_regs)) or 1.0
        for r in regions:
            r["seat_grade"] = ""
            r["ratio"] = float(r["area"] / area_sum) if r in valid_regs else 0.0
        if total_attendees:
            caps = [int(round(total_attendees * r["ratio"])) for r in regions]
            diff = total_attendees - sum(caps)
            if diff != 0 and regions:
                order_idx = np.argsort([-r["area"] for r in regions]) if diff > 0 else np.argsort([r["area"] for r in regions])
                i = 0
                while diff != 0 and i < len(order_idx):
                    idx = int(order_idx[i])
                    if diff > 0:
                        caps[idx] += 1; diff -= 1
                    else:
                        if caps[idx] > 0:
                            caps[idx] -= 1; diff += 1
                    i = (i + 1) % len(order_idx)
            for r, c in zip(regions, caps):
                r["capacity"] = int(max(0, c))
                r["component_count"] = int(max(1, math.ceil(r["capacity"] / max(1, seats_per_component))))
        else:
            for r in regions:
                r["capacity"] = None
                r["component_count"] = None
        return

    def _trimmed_mean(xs: List[float], trim: float = 0.10) -> float:
        if not xs:
            return float("inf")
        arr = np.sort(np.asarray(xs, dtype=np.float32))
        n = len(arr)
        lo = int(np.floor(n * trim)); hi = int(np.ceil(n * (1.0 - trim)))
        core = arr[lo:hi] if hi > lo else arr
        return float(core.mean() if core.size else arr.mean())

    group_mean_for_order: Dict[int, float] = {
        g: _trimmed_mean(dists, trim=0.10) for g, dists in by_group_for_order.items()
    }
    for g, dists in by_group_for_grade.items():
        if g not in group_mean_for_order:
            group_mean_for_order[g] = float(np.mean(dists))

    ordered_groups: List[int] = sorted(group_mean_for_order.keys(), key=lambda g: group_mean_for_order[g])
    m = len(ordered_groups)

    if m == 1:
        grade_seq = ["R"]
    elif m == 2:
        grade_seq = ["VIP", "R"]
    elif m == 3:
        grade_seq = ["VIP", "R", "S"]
    else:
        grade_seq = ["STANDING", "VIP", "R", "S"]

    assigned: Dict[int, str] = {}
    for i, g in enumerate(ordered_groups):
        assigned[g] = grade_seq[i] if i < len(grade_seq) else grade_seq[-1]

    for r in regions:
        g = int(r.get("color_group", -1))
        r["seat_grade"] = assigned.get(g, "")

    for r in regions:
        g = int(r.get("color_group", -1))
        if g in group_mean_for_order:
            r["group_meanD"] = float(group_mean_for_order[g])
            r["group_count"] = int(len(by_group_for_grade.get(g, [])))
    
    # --- [Late-Attach] 등급 미부여 조각을 기존 그룹에 흡수 ---
    # 조건: seat_grade 비었고, 무대/텍스트/순수회색/검정/강제무대가 아니며,
    #       주변에 이미 등급 받은 이웃이 있고, 그 이웃의 그룹 평균색과 LAB ΔE가 color_delta 근처(조금 여유) 이내.
    #       (거리도 평균에서 너무 벗어나지 않으면 가산)
    from collections import Counter

    # 그룹별 평균 LAB/거리 준비
    group_stats = {}
    for r in regions:
        g = int(r.get("color_group", -1))
        if g >= 0 and r.get("seat_grade"):
            labv = r.get("lab_med") or r.get("lab_for_group")
            if labv is None:
                continue
            group_stats.setdefault(g, {"labs": [], "ds": []})
            group_stats[g]["labs"].append(np.array(labv, dtype=float))
            if r.get("distance_to_stage") is not None:
                group_stats[g]["ds"].append(float(r["distance_to_stage"]))

    for g, st in group_stats.items():
        if st["labs"]:
            st["lab_mean"] = np.mean(st["labs"], axis=0)
        if st["ds"]:
            st["d_mean"] = float(np.mean(st["ds"]))

    def _deltaE(a, b):
        a = np.array(a, dtype=float); b = np.array(b, dtype=float)
        return float(np.linalg.norm(a - b))

    for r in regions:
        # 이미 등급 있으면 패스
        if r.get("seat_grade"):
            continue
        # 명백한 제외 조건
        if r.get("force_render_stage"): 
            continue
        if str(r.get("role","")).lower() == "stage" or str(r.get("kind","")).lower() == "stage":
            continue
        if str(r.get("label","")).upper() == "STAGE" or str(r.get("id","")).startswith("poly_STAGE"):
            continue
        if r.get("is_textish", False) or r.get("is_black", False):
            continue
        # 순수 회색은 패스 (단, 앞선 회색-오버라이드 로직에서 chroma로 이미 구제된 건 통과됨)
        lab = r.get("lab_med") or r.get("lab_for_group")
        if lab is None:
            continue

        # 등급 가진 이웃만 대상으로 그룹 후보 수집
        neigh_ids = r.get("neighbors") or []
        neigh_regs = [nr for nr in regions if nr.get("id") in set(neigh_ids) and nr.get("seat_grade")]
        if not neigh_regs:
            continue

        cand_groups = sorted(set(int(nr.get("color_group", -1)) for nr in neigh_regs if int(nr.get("color_group", -1)) >= 0))
        best = None
        for g in cand_groups:
            st = group_stats.get(g)
            if not st or ("lab_mean" not in st):
                continue
            dE = _deltaE(lab, st["lab_mean"])
            # 색상은 color_delta보다 살짝 여유(1.10배)로 합류 허용
            if dE <= float(color_delta) * 1.10:
                ok_dist = True
                if r.get("distance_to_stage") is not None and ("d_mean" in st):
                    # 거리도 평균에서 크게 벗어나지 않으면 가산
                    dmean = float(st["d_mean"])
                    if dmean > 0:
                        ok_dist = abs(float(r["distance_to_stage"]) - dmean) <= (0.35 * dmean)
                score = dE + (0.0 if ok_dist else 1e3)
                best = (score, g) if (best is None or score < best[0]) else best

        # 합류 확정 → color_group/seat_grade 부여
        if best is not None and best[0] < 1e3:
            g = best[1]
            r["color_group"] = int(g)
            # 이웃의 등급 최빈값으로 부여 (간단하고 안정적)
            grades = [nr.get("seat_grade") for nr in neigh_regs if int(nr.get("color_group", -1)) == g and nr.get("seat_grade")]
            if grades:
                r["seat_grade"] = Counter(grades).most_common(1)[0][0]
            # 그룹 평균 거리 저장(렌더/디버그 일관성)
            st = group_stats.get(g, {})
            if "d_mean" in st:
                r["group_meanD"] = float(st["d_mean"])

    dists_all = np.array([r["distance_to_stage"] for r in valid_regs], dtype=np.float32)
    if dists_all.size > 0:
        q1, q2, q3 = np.quantile(dists_all, quartiles).tolist()
        for r in regions:
            d = r["distance_to_stage"]
            r["ring_index"] = int(0 if d <= q1 else 1 if d <= q2 else 2 if d <= q3 else 3)

    area_sum = float(sum(r["area"] for r in valid_regs)) or 1.0
    for r in regions:
        r["ratio"] = float(r["area"] / area_sum) if r in valid_regs else 0.0

    if total_attendees:
        caps = [int(round(total_attendees * r["ratio"])) for r in regions]
        diff = total_attendees - sum(caps)
        if diff != 0 and regions:
            order_idx = np.argsort([-r["area"] for r in regions]) if diff > 0 else np.argsort([r["area"] for r in regions])
            i = 0
            while diff != 0 and i < len(order_idx):
                idx = int(order_idx[i])
                if diff > 0:
                    caps[idx] += 1; diff -= 1
                else:
                    if caps[idx] > 0:
                        caps[idx] -= 1; diff += 1
                i = (i + 1) % len(order_idx)
        for r, c in zip(regions, caps):
            r["capacity"] = int(max(0, c))
            r["component_count"] = int(max(1, math.ceil(r["capacity"] / max(1, seats_per_component))))
    else:
        for r in regions:
            r["capacity"] = None
            r["component_count"] = None

    # --- 등급 확정 후: 좌석은 항상 인터랙티브로 언락 ---
    for r in regions:
        if r.get("seat_grade"):            # 등급이 부여된 좌석이면
            r["non_interactive"] = 0       # 이전 단계 플래그 초기화
            r["non_interactive_stage"] = False

def _poly_to_bbox(poly: List[List[int]]) -> Tuple[int, int, int, int]:
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    return x0, y0, x1 - x0 + 1, y1 - y0 + 1

def bbox_iou_xywh(a, b) -> float:
    ax, ay, aw, ah = a; bx, by, bw, bh = b
    ax2, ay2 = ax + aw, ay + ah
    bx2, by2 = bx + bw, by + bh
    ix1, iy1 = max(ax, bx), max(ay, by)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    union = aw * ah + bw * bh - inter
    return inter / max(1, union)

def _normalize_stage_text(s: str) -> str:
    return re.sub(r"[\s\-\:\._]+", "", s or "", flags=re.UNICODE).lower()

def detect_stage_bboxes_from_lines(lines: List[Dict[str, Any]]) -> List[Tuple[int, int, int, int]]:
    bbs = []
    for ln in lines:
        raw = ln.get("text") or ""
        txt = _normalize_stage_text(raw)
        if any(k in txt for k in STAGE_KEYWORDS):
            poly = ln.get("poly") or []
            if len(poly) >= 3:
                bbs.append(_poly_to_bbox(poly))
    return bbs

def union_bbox_xywh(bbs: List[Tuple[int, int, int, int]]) -> Optional[Tuple[int, int, int, int]]:
    if not bbs:
        return None
    xs = [x for x, y, w, h in bbs]
    ys = [y for x, y, w, h in bbs]
    x2s = [x + w for x, y, w, h in bbs]
    y2s = [y + h for x, y, w, h in bbs]
    x0, y0, x1, y1 = min(xs), min(ys), max(x2s), max(y2s)
    return (x0, y0, x1 - x0, y1 - y0)

# ----------------------------
# 텍스트/회색/검정 판정 유틸
# ----------------------------

def mark_gray_black_textish_flags(bgr: np.ndarray, regions: List[Dict[str, Any]], gray_thr: Dict[str, float]) -> None:
    h, w = bgr.shape[:2]
    lab_full = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    gmask_full = is_gray_lab(lab_full, gray_thr["chroma_thr"], gray_thr["L_low"], gray_thr["L_high"]).astype(np.uint8) * 255

    for r in regions:
        m = mask_from_polygon(h, w, r["polygon"])
        total = cv2.countNonZero(m)
        gray_ratio = 0.0
        if total > 0:
            g_inside = cv2.countNonZero(cv2.bitwise_and(m, gmask_full))
            gray_ratio = float(g_inside) / float(total)
        r["gray_ratio_region"] = gray_ratio

        med_lab = r.get("lab_med", [0.0, 0.0, 0.0])
        r["is_gray"]  = lab_is_gray_vec(med_lab, gray_thr["chroma_thr"], gray_thr["L_low"], gray_thr["L_high"])
        r["is_black"] = lab_is_black_vec(med_lab)

        bx, by, bw, bh = r["bbox"]
        asp = max(bw / max(1, bh), bh / max(1, bw))
        r["is_textish"] = (gray_ratio >= TEXT_GRAY_RATIO_MIN) and (r["area"] <= TEXT_AREA_MAX) and (asp >= TEXT_ASPECT_MIN)

        r["lab_for_group"] = [float(x) for x in med_lab]

# ----------------------------
# Stage placeholder & flags
# ----------------------------

# ✅ 1) STAGE placeholder 주입 함수 (가드 + render:0 포함)
def _add_stage_placeholder_if_missing(
    regions: List[Dict[str, Any]],
    stage_union_xywh: Optional[Tuple[int,int,int,int]],
    bgr: np.ndarray
) -> None:
    if not stage_union_xywh:
        return
    if any(str(r.get("id","")).startswith("poly_STAGE") for r in regions):
        return

    H, W = bgr.shape[:2]
    x, y, w, h = stage_union_xywh
    if w <= 0 or h <= 0:
        return

    # --- 가드: 너무 애매한 bbox는 주입하지 않음 ---
    area_abs = w * h
    area_min = 0.004 * (W * H)
    too_low = (y > 0.65 * H)                     # 하단 35% 영역이면 제외
    not_wide_enough = (w / max(1, h) < 1.4)      # 가로비 부족

    if (area_abs < area_min) or too_low or not_wide_enough:
        return

    # 이미 stage-like가 실제로 충분히 겹치면 placeholder 불필요
    def _area_overlap_frac(poly):
        return _overlap_fraction_poly_rect(H, W, poly, (x, y, w, h))

    for r in regions:
        poly = r.get("polygon")
        if not poly:
            continue
        if r.get("like_stage_color", False) and _area_overlap_frac(poly) >= 0.10:
            return

    # --- placeholder 생성 (윤곽선으로 렌더) ---
    x = max(0, min(W - 1, int(x))); y = max(0, min(H - 1, int(y)))
    w = max(1, min(W - x, int(w))); h = max(1, min(H - y, int(h)))

    poly = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
    poly_np = np.array(poly, np.int32)
    area = float(cv2.contourArea(poly_np))
    if area <= 1:
        return

    # 대표색(있어도 됨, outline로만 쓸 거지만)
    lab = cv2.cvtColor(bgr[y:y+h, x:x+w], cv2.COLOR_BGR2LAB).astype(np.float32)
    med_lab = np.median(lab.reshape(-1, 3), axis=0).astype(np.uint8)
    med_bgr = cv2.cvtColor(med_lab.reshape(1, 1, 3), cv2.COLOR_Lab2BGR).reshape(3,)
    fill_hex = to_hex(med_bgr.tolist() if hasattr(med_bgr, "tolist") else med_bgr)

    cx, cy = x + w / 2.0, y + h / 2.0

    regions.append({
        "id": "poly_STAGE",
        "polygon": poly,
        "bbox": [int(x), int(y), int(w), int(h)],
        "centroid": [float(cx), float(cy)],
        "area": area,
        "perimeter": float(cv2.arcLength(poly_np, True)),
        "fill": fill_hex,
        "lab_med": [int(med_lab[0]), int(med_lab[1]), int(med_lab[2])],
        "two_color_mix": None,
        "force_render_stage": False,     # 주 스테이지 아님(placeholder)
        "exclude_from_level": True,
        "non_interactive_stage": True,
        "render": 1,                     # ✅ 일반 뷰에서 그리되,
        "as_outline": True               # ✅ 윤곽선으로만 표시
    })

def _overlap_fraction_poly_rect(h: int, w: int, poly: List[List[int]], rect_xywh: Tuple[int,int,int,int]) -> float:
    m_poly = mask_from_polygon(h, w, poly)
    x, y, rw, rh = rect_xywh
    m_rect = np.zeros((h, w), np.uint8)
    cv2.rectangle(m_rect, (int(x), int(y)), (int(x+rw), int(y+rh)), 255, -1)
    inter = cv2.countNonZero(cv2.bitwise_and(m_poly, m_rect))
    area_poly = cv2.countNonZero(m_poly)
    return (inter / area_poly) if area_poly > 0 else 0.0

def _mark_stage_overlaps_and_noninteractive(
    regions: List[Dict[str, Any]],
    stage_union_xywh: Optional[Tuple[int,int,int,int]],
    bgr: np.ndarray,
    *,
    primary_stage_id: Optional[str] = None,
    iou_thr_bbox: float = STAGE_OVERLAP_IOU,   # 가벼운 임계치 (기본 0.005~0.025)
    area_overlap_thr: float = 0.02,            # 실제 폴리곤-무대박스 겹침 면적 비율 임계
    like_stage_deltaE: float = 10.0,           # 무대색과 유사하면 완화
    stage_lab_ref: Optional[np.ndarray] = None,
) -> None:
    if not stage_union_xywh:
        return

    h, w = bgr.shape[:2]
    sx, sy, sw, sh = [int(v) for v in stage_union_xywh]
    if sw <= 0 or sh <= 0:
        return

    # STAGE 사각형 마스크/대표색
    stage_rect = np.array([[sx, sy], [sx+sw, sy], [sx+sw, sy+sh], [sx, sy+sh]], dtype=np.int32)
    stage_mask = np.zeros((h, w), np.uint8)
    cv2.fillPoly(stage_mask, [stage_rect], 255)

    sub = bgr[max(0, sy):min(h, sy+sh), max(0, sx):min(w, sx+sw)]
    lab_stage = cv2.cvtColor(sub, cv2.COLOR_BGR2LAB).astype(np.float32)
    stage_med = np.median(lab_stage.reshape(-1, 3), axis=0) if stage_lab_ref is None else stage_lab_ref

    def _to_x1y1x2y2_any(box):
        x, y, w_, h_ = [int(v) for v in box]
        if w_ <= 0 or h_ <= 0:
            return (x, y, w_, h_)  # 이미 x1y1x2y2
        return (x, y, x + w_, y + h_)

    s_box = _to_x1y1x2y2_any((sx, sy, sw, sh))

    for r in regions:
        rid = str(r.get("id", ""))

        # 초기화
        if rid != primary_stage_id:
            r["non_interactive_stage"] = False
        r["like_stage_color"] = False
        r["area_overlap_frac"] = 0.0

        # 주 스테이지는 그대로
        if rid == primary_stage_id:
            continue
        poly = r.get("polygon")
        if not poly:
            continue

        # bbox IoU (x1y1x2y2 정규화)
        bx, by, bw, bh = r.get("bbox", _bbox_from_poly(poly))
        r_box = _to_x1y1x2y2_any((bx, by, bw, bh))
        iou = _bbox_iou(r_box, s_box)

        # 실제 폴리곤-사각형 겹침 비율
        pmask = mask_from_polygon(h, w, poly)
        inter = cv2.countNonZero(cv2.bitwise_and(pmask, stage_mask))
        area_poly = float(max(1, cv2.countNonZero(pmask)))
        overlap_frac = inter / area_poly
        r["area_overlap_frac"] = float(overlap_frac)

        # 무대 유사색 (회색/검정은 더 느슨하게)
        lab_med_r = r.get("lab_med") or r.get("lab_for_group")
        is_grayish = bool(r.get("is_gray", False) or r.get("is_black", False))
        like_stage = False
        if lab_med_r is not None:
            dE = float(np.linalg.norm(np.array(lab_med_r, float) - np.array(stage_med, float)))
            like_stage = (dE <= like_stage_deltaE) or is_grayish
        r["like_stage_color"] = bool(like_stage)

        # 최종 판정:
        # - bbox IoU가 아주 작아도, 실제 overlap_frac이 충분히 크거나(stage 위에 일부라도 올라탐),
        #   색이 무대색과 유사하면 비상호작용으로 마킹
        if (iou >= float(iou_thr_bbox)) or (overlap_frac >= float(area_overlap_thr)) or like_stage:
            r["non_interactive_stage"] = True

def maybe_inject_stage_after_mark(
    regions: List[Dict[str, Any]],
    stage_union: Optional[Tuple[int,int,int,int]],
    bgr: np.ndarray,
    *,
    primary_stage_id: Optional[str],
    stage_only: bool
) -> None:
    allow_placeholder = False
    if False:
        joined = " ".join(str(it.get("text", "")).lower() for it in ocr_lines_norm)
        allow_placeholder = any(k in joined for k in ["stage","무대","스테이지"])

    # 🔴 stage_only면 키워드 없이도 허용. 일반 모드는 키워드 있을 때만.
    if stage_only and (not primary_stage_id) and (stage_union is not None):
        _inject_synthetic_stage_region(regions, stage_union)
        _add_stage_placeholder_if_missing(regions, stage_union, bgr)

# ----------------------------
# HTML Render (pretty + OCR overlay)
# ----------------------------

def write_svg_html(
    img_bgr,
    regions,
    out_html: Path,
    *,
    opacity=0.95,
    color_summary: Optional[List[Dict[str, Any]]] = None,
    debug_imgs: Optional[List[np.ndarray]] = None,
    min_render_area: int = DEFAULT_MIN_RENDER_AREA,
    stage_only: bool = False,   # A안에서도 파라미터는 유지(디버그용), 저장만 안함
):
    h, w = img_bgr.shape[:2]

    def _is_primary_stage(r: Dict[str, Any]) -> bool:
        # 주 스테이지: pipeline에서 확정된 1개(=force_render_stage=True)
        return bool(r.get("force_render_stage", False))

    def _is_placeholder_stage(r: Dict[str, Any]) -> bool:
        # 합성 STAGE 사각형(id가 poly_STAGE로 시작) — A안에서는 전혀 렌더하지 않음
        return str(r.get("id", "")).startswith("poly_STAGE")

    def _should_render(r: Dict[str, Any]) -> bool:
        rid = str(r.get("id", ""))

        # stage-only 모드: 주 스테이지만
        if stage_only:
            return bool(r.get("force_render_stage", False))

        # 명시적 비렌더
        if int(r.get("render", 1)) == 0:
            return False

        # ✅ 주 스테이지는 무조건 통과
        if r.get("force_render_stage", False):
            return True

        # ✅ placeholder STAGE(poly_STAGE*)도 보이게 — (비인터랙티브로 표시)
        if rid.startswith("poly_STAGE"):
            return True

        # 텍스트형은 제거
        if r.get("is_textish", False):
            return False

        # ✅ STAGE와 겹치는 폴리곤은 색상과 무관하게 '렌더는 허용' (등급/상호작용 제외)
        if r.get("non_interactive_stage", False):
            return True

        # 회색/검정 기본 렌더 제외
        if r.get("is_black", False) or r.get("is_gray", False):
            return False

        # 색상 그룹 미할당은 숨김(좌석 아님)
        if int(r.get("color_group", -1)) < 0:
            return False

        # 너무 작은 건 컷
        if float(r.get("area", 0.0)) < float(min_render_area):
            return False

        return True


    render_regions = [r for r in regions if _should_render(r)]

    # --- 패턴 정의(혼합 색) ---
    defs = []
    for r in render_regions:
        mix = (r.get("two_color_mix") or {})
        if mix.get("is_mixed") and isinstance(mix.get("hex_colors"), (list, tuple)) and len(mix["hex_colors"]) == 2:
            pid = "pat_" + str(r["id"])
            c0, c1 = mix["hex_colors"]
            defs.append("\n".join([
                f"      <pattern id='{pid}' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'>",
                f"        <rect width='8' height='8' fill='{c0}'/>",
                f"        <rect width='4' height='8' fill='{c1}'/>",
                "      </pattern>",
            ]))
    defs_html = "    <defs>\n" + "\n".join(defs) + "\n    </defs>" if defs else ""

    # --- 인터랙션/레이어링 정렬(주 스테이지 맨 아래 → 비인터랙티브 → 작은 것 위)
    def _is_interactive(r: Dict[str, Any]) -> bool:
        return bool(r.get("seat_grade"))

    render_regions_sorted = sorted(
        render_regions,
        key=lambda r: (
            0 if _is_primary_stage(r) else 1,
            0 if not _is_interactive(r) else 1,
            r.get("area", 0)
        )
    )

    # --- 폴리곤 SVG 생성 ---
    polys_html = []
    for r in render_regions_sorted:
        pts_src = r.get("polygon") or r.get("points") or []
        if not pts_src:
            continue
        pts = " ".join(f"{int(x)},{int(y)}" for x, y in pts_src)

        # A안: placeholder는 여기까지 오지 않음(이미 _should_render에서 컷)
        interactive = _is_interactive(r) and not bool(r.get("non_interactive_stage", False))
        style = "pointer-events:all; cursor:pointer" if interactive else "pointer-events:none; cursor:default"

        mix = (r.get("two_color_mix") or {})
        fill_val = f"url(#pat_{r['id']})" if mix.get("is_mixed") else str(r.get("fill", "#cccccc"))

        attr = {
            "data-id": str(r.get("id", "")),
            "data-fill": str(r.get("fill", "")),
            "data-seat-grade": str(r.get("seat_grade", "")),
            "data-capacity": str(r.get("capacity", "")),
            "data-component-count": str(r.get("component_count", "")),
            "data-ratio": str(r.get("ratio", "")),
            "data-color-group": "" if r.get("color_group") in (None, -1) else str(r.get("color_group")),
            "data-non-interactive": "0" if interactive else "1",
            "data-meanD": f"{r.get('group_meanD','')}",
            "data-ring": f"{r.get('ring_index','')}",
        }
        data_attr = " ".join(f'{k}="{attr[k]}"' for k in attr)
        acc = ' tabindex="0" role="button"' if interactive else ""

        polys_html.append(
            f'      <polygon points="{pts}" fill="{fill_val}" style="{style}"'
            f'               fill-opacity="{opacity}" stroke="#222" stroke-opacity="0.55"'
            f'               stroke-width="1" {data_attr}{acc}></polygon>'
        )

    svg_parts = [
        f'    <svg viewBox="0 0 {w} {h}" width="620" height="620" tabindex="-1" focusable="false" style="outline:none;" xmlns="http://www.w3.org/2000/svg">',
        defs_html if defs_html else "",
        *polys_html,
        "    </svg>",
    ]
    svg = "\n".join([p for p in svg_parts if p])

    # # --- 레전드 ---
    # legend_note = (
    #     "Stage-only debug view. Only PRIMARY STAGE is shown."
    #     if stage_only else
    #     "Gray/Black hidden. Stage placeholder is drawn (Plan B)."
    # )
    # legend_html = _legend_html(color_summary or [], legend_note)
    legend_html = ""
    # --- OCR 라벨 ---
    # OCR overlay removed
    ocr_layer_html = ""

    # --- 스크립트/스타일 ---
    script = "\n".join([
        "    <script>",
        "      const tip=document.createElement('div');",
        "      tip.style.position='fixed'; tip.style.pointerEvents='none';",
        "      tip.style.padding='6px 8px'; tip.style.background='rgba(0,0,0,0.75)';",
        "      tip.style.color='#fff'; tip.style.font='12px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial';",
        "      tip.style.borderRadius='6px'; tip.style.boxShadow='0 2px 8px rgba(0,0,0,.25)';",
        "      tip.style.zIndex='9999'; tip.style.transform='translate(-50%,-140%)'; tip.style.display='none';",
        "      document.body.appendChild(tip);",
        "      function showTip(e,p){",
        "        const gr=p.dataset.seatGrade||''; const id=p.dataset.id||'';",
        "        tip.textContent=(gr&&id)?(gr+' • '+id):(gr||id);",
        "        tip.style.left=e.clientX+'px'; tip.style.top=e.clientY+'px'; tip.style.display='block';",
        "      }",
        "      function hideTip(){ tip.style.display='none'; }",
        "      document.addEventListener('mousemove',e=>{",
        "        const p=e.target.closest('polygon');",
        "        if(!p){ hideTip(); return; }",
        "        if(getComputedStyle(p).pointerEvents==='none'){ hideTip(); return; }",
        "        showTip(e,p);",
        "      });",
        "      document.addEventListener('click',e=>{",
        "        const p=e.target.closest('polygon'); if(!p) return;",
        "        if(getComputedStyle(p).pointerEvents==='none') return;",
        "        if(!p.dataset.seatGrade) return;",
        "        const d={",
        "          id:p.dataset.id, grade:p.dataset.seatGrade, group:p.dataset.colorGroup,",
        "          capacity:p.dataset.capacity, components:p.dataset.componentCount,",
        "          ratio:p.dataset.ratio, fill:p.dataset.fill, meanD:p.dataset.meanD, ring:p.dataset.ring",
        "        };",
        "        console.log('[seat-click]', d);",
        "      });",
        "    </script>",
    ])

    style = "\n".join([
        "    <style>",
        "      body{margin:0;background:#fff}",
        "      .wrapper{display:flex;align-items:center;justify-content:center;padding:16px}",
        "      .card{background:#fff;padding:8px;position:relative}",
        "      svg{display:block}",
        "      svg polygon{transition:stroke-width .1s ease}",
        '      svg polygon[data-non-interactive="1"] { pointer-events:none; cursor:default; opacity:.5; }',
        "      svg polygon[data-non-interactive='0']:hover{ stroke:#000; stroke-width:2; cursor:pointer }",
        "      .legend{position:fixed;right:12px;top:12px;background:#fff;border:1px solid #eee;border-radius:8px;padding:10px 12px;box-shadow:0 4px 16px rgba(0,0,0,.08);font:12px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial}",
        "      .legend .title{font-weight:600;margin-bottom:6px}",
        "      .legend .row{display:flex;align-items:center;gap:8px;margin:4px 0}",
        "      .legend .row .sw{display:inline-block;width:16px;height:12px;border-radius:3px;border:1px solid rgba(0,0,0,.15)}",
        "      .legend .row .txt{color:#111}",
        "      .legend .empty{color:#888}",
        "      .legend .note{margin-top:6px;color:#666}",
        "      .dbg-note{position:fixed;left:12px;bottom:12px;color:#666;font:12px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial}",
        "      .canvas-wrap{position:relative;display:inline-block}",
        "    </style>",
    ])

    debug_panel = "    <div class='dbg-note'>Debug thumbnails saved alongside outputs.</div>" if debug_imgs else ""

    html_parts = [
        "<!doctype html>",
        "<html>",
        "  <head>",
        "    <meta charset='utf-8'>",
        "    <title>Seatmap SVG</title>",
        f"{style}",
        "  </head>",
        "  <body>",
        "    <div class='wrapper'>",
        "      <div class='card'>",
        f"        <div class='canvas-wrap' style='width:{w}px;height:{h}px'>",
        f"{svg}",
        "",
        "        </div>",
        "      </div>",
        "    </div>",
        f"{debug_panel}",
        f"{script}",
        "  </body>",
        "</html>",
    ]
    html = "\n".join(html_parts)
    out_html.write_text(html, encoding="utf-8")
    return html

def write_svg_tsx(img_w: int, img_h: int, regions: list[dict], out_tsx: Path, *,
                  component_name: str = "SeatmapOverlay",
                  min_render_area: int = 0,
                  stage_only: bool = False) -> str:
    import re as _re

    def _is_primary_stage(r: dict) -> bool:
        rid = str(r.get("id",""))
        return rid.startswith("poly_STAGE") or r.get("force_render_stage", False)

    def _is_interactive(r: dict) -> bool:
        # 등급이 있고(stage가 아니고) non_interactive_stage가 아니면 클릭 가능
        return bool(r.get("seat_grade")) and not bool(r.get("non_interactive_stage", False))

    def _should_render(r: dict) -> bool:
        rid = str(r.get("id", ""))

        # stage-only: 주 스테이지만 출력
        if stage_only:
            return bool(r.get("force_render_stage", False))

        # 명시적 비렌더
        if int(r.get("render", 1)) == 0:
            return False

        # 주 스테이지는 무조건 렌더
        if r.get("force_render_stage", False):
            return True

        # placeholder STAGE도 보이게(비인터랙티브)
        if rid.startswith("poly_STAGE"):
            return True

        # 텍스트형 제외
        if r.get("is_textish", False):
            return False

        # STAGE 겹침이면 렌더만 허용(클릭 불가)
        if r.get("non_interactive_stage", False):
            return True

        # 회색/검정 기본 제외
        if r.get("is_black", False) or r.get("is_gray", False):
            return False

        # 색상 그룹 없으면 제외
        if int(r.get("color_group", -1)) < 0:
            return False

        # 너무 작은 면적 제외
        if float(r.get("area", 0.0)) < float(min_render_area):
            return False

        return True

    render_regions = [r for r in regions if _should_render(r)]
    render_regions_sorted = sorted(
        render_regions,
        key=lambda rr: (
            0 if _is_primary_stage(rr) else 1,
            0 if not _is_interactive(rr) else 1,
            rr.get("area", 0)
        )
    )

    poly_lines = []
    for r in render_regions_sorted:
        pts_src = r.get("polygon") or r.get("points") or []
        if not pts_src:
            continue
        pts = " ".join(f"{int(x)},{int(y)}" for x, y in pts_src)
        interactive = _is_interactive(r)
        fill_val = str(r.get("fill", "#cccccc"))

        # section/grade/totalRows/totalCols → 이름 그대로 속성으로 부여
        section_num = int(_re.sub(r"[^0-9]", "", str(r.get("id",""))) or "0")

        comp_cnt = int(r.get("component_count") or 0)
        rows_pre = r.get("totalRows")
        cols_pre = r.get("totalCols")
        if rows_pre in (None, "", 0) or cols_pre in (None, "", 0):
            rr, cc = _nearest_square_grid(comp_cnt) if comp_cnt > 0 else (0, 0)
        else:
            rr, cc = int(rows_pre), int(cols_pre)

        attr = {
            # data-* (호환)
            "data-id": str(r.get("id","")),
            "data-seat-grade": str(r.get("seat_grade","")),
            "data-component-count": str(r.get("component_count","")),
            "data-color-group": "" if r.get("color_group") in (None, -1) else str(r.get("color_group")),
            "data-total-rows": str(r.get("totalRows","")),
            "data-total-cols": str(r.get("totalCols","")),
            "data-section-area": str(r.get("section_area","")),
            "data-section-area-percent": str(r.get("section_area_percent","")),
            "data-non-interactive": "0" if interactive else "1",
            # 커스텀 속성(요청명 그대로)
            "section": str(section_num),
            "grade": str(r.get("seat_grade","")),
            "totalRows": str(rr if rr else ""),
            "totalCols": str(cc if cc else ""),
        }
        attr_str = " ".join(f'{k}="{v}"' for k, v in attr.items())

        # React/TSX 호환: pointerEvents prop + cursor만 style로
        pointer_attr = ' pointerEvents="all"' if interactive else ' pointerEvents="none"'
        style_part = " style={{cursor:'pointer'}}" if interactive else ""
        acc = ' tabIndex={0} role="button"' if interactive else ""

        poly_lines.append(
            f'<polygon points="{pts}" fill="{fill_val}" fillOpacity={{0.95}} '
            f'stroke="#222" strokeOpacity={{0.55}} strokeWidth={{1}}'
            f'{pointer_attr}{style_part} {attr_str}{acc} />'
        )

    tsx = f"""
import React from "react";

type SectionPayload = {{
  section: number;
  grade: string;
  totalRows: number;
  totalCols: number;
  seats: any[];
}};

interface Props {{
  onSectionClick?: (payload: SectionPayload) => void;
}}

const {component_name}: React.FC<Props> = ({{ onSectionClick }}) => {{
  const onClick = (e: React.MouseEvent<SVGElement>) => {{
    const t = e.target as SVGElement;
    if (!t || t.tagName.toLowerCase() !== 'polygon') return;
    const ds = (t as any).dataset || {{}};
    if (String(ds.nonInteractive) === "1") return;

    // 커스텀 속성 우선 → dataset 폴백
    const sectionAttr = t.getAttribute("section");
    const gradeAttr   = t.getAttribute("grade");
    const rowsAttr    = t.getAttribute("totalRows");
    const colsAttr    = t.getAttribute("totalCols");

    const section = parseInt(sectionAttr ?? String(ds.id || "0").replace(/[^0-9]/g, "")) || 0;
    const grade = String(gradeAttr ?? ds.seatGrade ?? "");
    const totalRows = parseInt(rowsAttr ?? ds.totalRows ?? "0") || 0;
    const totalCols = parseInt(colsAttr ?? ds.totalCols ?? "0") || 0;

    onSectionClick?.({{ section, grade, totalRows, totalCols, seats: [] }});
  }};

  return (
    <svg
      viewBox="0 0 {img_w} {img_h}"
      width={{620}}
      height={{620}}
      tabIndex={{-1}}
      focusable="false"
      style={{{{ outline: "none" }}}}
      xmlns="http://www.w3.org/2000/svg"
      onClick={{onClick}}
    >
      {"".join(poly_lines)}
    </svg>
  );
}};

export default {component_name};
"""
    out_tsx.write_text(tsx, encoding="utf-8")
    return tsx

# ----------------------------
# Debug HTML (폴리곤/스테이지/OCR 간단 시각화)
# ----------------------------

import base64 as _b64
import html as _py_html

# ----------------------------
# (Optional) External OCR hook
# ----------------------------

OCR_API_URL = ""

def call_ocr_extract_path(img_path: str, min_score: float = 0.5, mask_dilate: int = 2):
    # OCR removed
    return {}

def inpaint_with_mask(bgr: np.ndarray, mask_path: Optional[str]) -> np.ndarray:
    if not mask_path or not Path(mask_path).exists():
        return bgr
    m = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
    if m is None:
        return bgr
    er = cv2.morphologyEx(m, cv2.MORPH_ERODE, np.ones((2, 2), np.uint8), iterations=1)
    return cv2.inpaint(bgr, er, 2, cv2.INPAINT_TELEA)

# ----------------------------
# Stage 1: Foreground API
# ----------------------------
@fg_router.post("/mask")
async def api_fg_mask(file: UploadFile = File(...), k: int = Form(5), crop_legend: bool = Form(False)):
    in_path = DATA_DIR / file.filename
    with open(in_path, "wb") as f:
        f.write(await file.read())
    bgr = cv2.imread(str(in_path), cv2.IMREAD_COLOR)
    if bgr is None:
        return JSONResponse({"ok": False, "error": "invalid image"}, status_code=400)
    h, w = bgr.shape[:2]
    fg0 = global_bg_mask(bgr, k=k)
    if crop_legend:
        rows = fg0.sum(axis=1) / 255.0
        bottom_band = int(h * 0.25)
        band = rows[h - bottom_band:]
        idx = int(np.argmax(band < (0.02 * w)))
        if idx != 0:
            y_cut = h - bottom_band + idx
            fg0[y_cut:] = 0
    out_path = with_ts(RESULT_DIR, in_path.stem, "_fg.png")
    cv2.imwrite(str(out_path), fg0)
    return {"ok": True, "input": str(in_path), "fg_mask": str(out_path)}

# ----------------------------
# Stage 2: Text removal API
# ----------------------------
@text_router.post("/mask")
async def api_text_mask(file: UploadFile = File(...), use_fg_from: Optional[str] = Form(None)):
    in_path = DATA_DIR / file.filename
    with open(in_path, "wb") as f:
        f.write(await file.read())
    bgr = cv2.imread(str(in_path), cv2.IMREAD_COLOR)
    if bgr is None:
        return JSONResponse({"ok": False, "error": "invalid image"}, status_code=400)
    fg = cv2.imread(use_fg_from, cv2.IMREAD_GRAYSCALE) if use_fg_from else global_bg_mask(bgr, k=5)
    tmask = text_mask_mser(bgr, fg)
    out_path = with_ts(RESULT_DIR, in_path.stem, "_text.png")
    cv2.imwrite(str(out_path), tmask)
    return {"ok": True, "input": str(in_path), "text_mask": str(out_path)}

@text_router.post("/inpaint")
async def api_inpaint(file: UploadFile = File(...), text_mask_path: Optional[str] = Form(None)):
    in_path = DATA_DIR / file.filename
    with open(in_path, "wb") as f:
        f.write(await file.read())
    bgr = cv2.imread(str(in_path), cv2.IMREAD_COLOR)
    if bgr is None:
        return JSONResponse({"ok": False, "error": "invalid image"}, status_code=400)
    if text_mask_path and Path(text_mask_path).exists():
        tmask = cv2.imread(text_mask_path, cv2.IMREAD_GRAYSCALE)
    else:
        fg = global_bg_mask(bgr, k=5)
        tmask = text_mask_mser(bgr, fg)
    no_text = inpaint_soft(bgr, tmask)
    out_path = with_ts(RESULT_DIR, in_path.stem, "_no_text.png")
    cv2.imwrite(str(out_path), no_text)
    return {"ok": True, "input": str(in_path), "no_text": str(out_path)}

# ----------------------------
# Stage 3: Segmentation API
# ----------------------------
@seg_router.post("/run")
async def api_segment(
    file: UploadFile = File(...),
    min_area: Optional[int] = Form(None),
    iou_merge_thr: float = Form(0.48),
    mode: str = Form("ensemble")  # conn, slic, ws, ensemble
):
    in_path = DATA_DIR / file.filename
    with open(in_path, "wb") as f:
        f.write(await file.read())
    bgr = cv2.imread(str(in_path), cv2.IMREAD_COLOR)
    if bgr is None:
        return JSONResponse({"ok": False, "error": "invalid image"}, status_code=400)
    h, w = bgr.shape[:2]
    if min_area is None:
        min_area = max(int(auto_min_area(h, w) * 0.85), 120)

    fg = global_bg_mask(bgr, k=5)
    no_text = bgr.copy()

    lists = []
    if mode in ("conn", "ensemble"):
        lists.append(seg_conncomp(no_text, fg, min_area, color_bgr=bgr))
    if mode in ("slic", "ensemble"):
        lists.append(seg_slic(no_text, fg, min_area, deltaE_merge=COLOR_DELTA, color_bgr=bgr))
    if mode in ("ws", "ensemble"):
        lists.append(seg_watershed(no_text, fg, min_area, color_bgr=bgr))
    regions = merge_ensemble(h, w, lists, iou_merge_thr=iou_merge_thr) if mode == "ensemble" else lists[0]

    gray_thr = estimate_gray_thresholds(bgr)
    mark_gray_black_textish_flags(bgr, regions, gray_thr)
    regions = [r for r in regions if not r.get("is_textish", False)
    ]

    return {"ok": True, "regions": regions, "h": h, "w": w, "min_area": int(min_area), "color_delta": COLOR_DELTA}

# ----------------------------
# Stage 4: Stage center API
# ----------------------------

@stage_router.post("/center")
async def api_stage_center(file: UploadFile = File(...), prefer_top_stage: bool = Form(True)):
    in_path = DATA_DIR / file.filename
    with open(in_path, "wb") as f:
        f.write(await file.read())
    bgr = cv2.imread(str(in_path), cv2.IMREAD_COLOR)
    if bgr is None:
        return JSONResponse({"ok": False, "error": "invalid image"}, status_code=400)
    cx, cy = estimate_stage_center(bgr, prefer_top_stage=prefer_top_stage)
    return {"ok": True, "stage_center": {"cx": int(cx), "cy": int(cy)}}

# ----------------------------
# Stage 5: Gray/Mix + grouping API
# ----------------------------

@analy_router.post("/graymix")
async def api_graymix(
    file: UploadFile = File(...),
    regions_json: str = Form(...),
    gray_exclude_ratio: float = Form(0.55),
    gray_chroma_quantile: float = Form(LAB_GRAY_Q),
    strong_gray_exclude: bool = Form(True)
):
    in_path = DATA_DIR / file.filename
    with open(in_path, "wb") as f:
        f.write(await file.read())
    bgr = cv2.imread(str(in_path), cv2.IMREAD_COLOR)
    if bgr is None:
        return JSONResponse({"ok": False, "error": "invalid image"}, status_code=400)
    regions = json.loads(regions_json)
    h, w = bgr.shape[:2]

    gray_thr = estimate_gray_thresholds(bgr, q=gray_chroma_quantile)
    lab_full = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    gmask_full = is_gray_lab(lab_full, gray_thr["chroma_thr"], gray_thr["L_low"], gray_thr["L_high"]).astype(np.uint8) * 255
    graymask_path = with_ts(RESULT_DIR, in_path.stem, "_graymask.png")
    cv2.imwrite(str(graymask_path), gmask_full)

    ex_ids = set()
    for r in regions:
        m = mask_from_polygon(h, w, r["polygon"])
        total = cv2.countNonZero(m)
        if total > 0:
            g_inside = cv2.countNonZero(cv2.bitwise_and(m, gmask_full))
            r["gray_ratio_region"] = float(g_inside) / float(total)
        med_lab = r.get("lab_med", [0.0, 0.0, 0.0])
        strong_repr = bool(lab_is_gray_vec(med_lab, gray_thr["chroma_thr"], gray_thr["L_low"], gray_thr["L_high"])) if strong_gray_exclude else False
        if strong_repr or (r.get("gray_ratio_region", 0.0) >= gray_exclude_ratio):
            ex_ids.add(r["id"])
        r["lab_for_group"] = [float(x) for x in med_lab]

    mark_gray_black_textish_flags(bgr, regions, gray_thr)
    regions = [r for r in regions if not r.get("is_textish", False)]

    return {
        "ok": True,
        "regions": regions,
        "excluded_gray_ids": sorted(list(ex_ids)),
        "gray_thresholds": gray_thr,
        "graymask_path": str(graymask_path)
    }

# ----------------------------
# Stage 6: Assign API
# ----------------------------

@assign_router.post("/levels")
async def api_assign_levels(
    regions_json: str = Form(...),
    stage_cx: int = Form(...),
    stage_cy: int = Form(...),
    total_attendees: Optional[int] = Form(None),
    q1: float = Form(0.20), q2: float = Form(0.45), q3: float = Form(0.75),
    seats_per_component: int = Form(1),
    neighbor_gap_px: int = Form(12),
    level_names_csv: str = Form(""),
    excluded_gray_ids_json: str = Form("[]")
):
    regions = json.loads(regions_json)
    excluded = set(json.loads(excluded_gray_ids_json))
    assign_levels_and_capacity(
        regions,
        (stage_cx, stage_cy),
        total_attendees,
        (q1, q2, q3),
        seats_per_component,
        color_delta=COLOR_DELTA,
        exclude_gray_ids=excluded,
        neighbor_gap_px=int(neighbor_gap_px)
    )
    color_summary = _color_group_summary([r for r in regions if r.get("seat_grade")])
    return {"ok": True, "regions": regions, "color_summary": color_summary}

# ----------------------------
# Stage 7: Render API
# ----------------------------

@render_router.post("/html")
async def api_render_html(
    file: UploadFile = File(...),
    regions_json: str = Form(...),
    color_summary_json: str = Form("[]"),
    opacity: float = Form(0.95),
    min_render_area: int = Form(0)
):
    in_path = DATA_DIR / file.filename
    with open(in_path, "wb") as f:
        f.write(await file.read())
    bgr = cv2.imread(str(in_path), cv2.IMREAD_COLOR)
    if bgr is None:
        return JSONResponse({"ok": False, "error": "invalid image"}, status_code=400)
    regions = json.loads(regions_json)
    color_summary = json.loads(color_summary_json)
    out_html_path = with_ts(RESULT_DIR, in_path.stem, "_stage.html")
    html_text = write_svg_html(
        bgr, regions, out_html_path,
        opacity=opacity, color_summary=color_summary, debug_imgs=None,
        min_render_area=int(min_render_area)
    )
    return {"ok": True, "html_path": str(out_html_path)}

# ----------------------------
# Files / Listing
# ----------------------------

@files_router.get("")
def list_outputs():
    return {
        "result": [str(p) for p in sorted(RESULT_DIR.glob("*"))],
        "meta":   [str(p) for p in sorted(META_DIR.glob("*"))],
    }

@files_router.get("/download")
def download(path: str):
    p = Path(path)
    if not p.exists():
        return JSONResponse({"ok": False, "error": "file not found", "path": path}, status_code=404)
    return FileResponse(str(p))

@files_router.get("/download_html")
def download_html(path: str):
    p = Path(path)
    if not p.exists():
        return JSONResponse({"ok": False, "error": "file not found", "path": path}, status_code=404)
    if p.suffix.lower() != ".html":
        return JSONResponse({"ok": False, "error": "only .html allowed", "path": path}, status_code=400)
    try:
        _ = p.resolve().relative_to(RESULT_DIR.resolve())
    except Exception:
        return JSONResponse({"ok": False, "error": "path must be inside result dir", "path": path}, status_code=403)
    html = p.read_text(encoding="utf-8", errors="ignore")
    headers = {"Content-Disposition": f'inline; filename="{p.name}"'}
    return Response(content=html, media_type="text/html; charset=utf-8", headers=headers)

@files_router.get("/download_meta")
def download_meta(path: str):
    p = Path(path)
    if not p.exists():
        return JSONResponse({"ok": False, "error": "file not found", "path": path}, status_code=404)
    if p.suffix.lower() != ".json":
        return JSONResponse({"ok": False, "error": "only .json allowed", "path": path}, status_code=400)
    try:
        _ = p.resolve().relative_to(META_DIR.resolve())
    except Exception:
        return JSONResponse({"ok": False, "error": "path must be inside meta dir", "path": path}, status_code=403)
    text = p.read_text(encoding="utf-8", errors="ignore")
    headers = {"Content-Disposition": f'inline; filename="{p.name}"'}
    return Response(content=text, media_type="application/json; charset=utf-8", headers=headers)

# ----------------------------
# Integrated Pipeline (once)
# ----------------------------

def _process_image_pipeline(
    img_path: Path,
    *,
    crop_legend: bool = False,
    ensemble: bool = True,
    min_area: Optional[int] = None,
    iou_merge_thr: float = 0.58,
    prefer_top_stage: bool = False,
    stage_cx: Optional[int] = None,
    stage_cy: Optional[int] = None,
    total_attendees: Optional[int] = None,
    quartiles: Tuple[float, float, float] = (0.20, 0.45, 0.75),
    seats_per_component: int = 1,
    neighbor_gap_px: int = 12,
    gray_exclude_ratio: float = 0.25,
    gray_chroma_quantile: float = LAB_GRAY_Q,
    strong_gray_exclude: bool = True,
    min_render_area: int = DEFAULT_MIN_RENDER_AREA,
    stage_only: bool = False,
    hall_name: str | None = None,
):
    """
    결과: TSX만 생성 (디버그/메타/HTML 저장 없음)
    반환 튜플(고정 4개): (tsx_path, meta_json_path=None, tsx_text, sections_json_path=None)
    """
    pipeline_start = time.perf_counter()
    logger.info("image_pipeline start path=%s", img_path)
    bgr = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(str(img_path))
    h, w = bgr.shape[:2]

    # --- 최소 면적 자동 보정
    if min_area is None:
        min_area = max(int(auto_min_area(h, w) * 0.85), 120)

    # --- 1) FG
    fg0 = global_bg_mask(bgr, k=5)
    fg = fg0.copy()
    if crop_legend:
        rows = fg.sum(axis=1) / 255.0
        bottom_band = int(h * 0.25)
        band = rows[h - bottom_band:]
        idx = int(np.argmax(band < (0.02 * w)))
        if idx != 0:
            y_cut = h - bottom_band + idx
            fg[y_cut:] = 0

    # --- 2) OCR 인페인트 비활성 (성능 최적화)
    base_for_seg = bgr

    # --- 3) 세그멘트: 빠른 경로만 (conncomp + slic)
    regions = segment_with_text_robust(
        base_for_seg,
        fg_mask=fg,
        min_area=int(min_area),
        iou_merge_thr=float(iou_merge_thr),
        seg_conncomp=seg_conncomp,
        seg_slic=seg_slic,
        seg_watershed=seg_watershed,   # fast=True라 내부에서 호출되지 않음
        merge_ensemble=merge_ensemble,
        COLOR_DELTA=COLOR_DELTA,
        fast=True
    )

    # --- 4) Stage center + 휴리스틱 보강 (OCR OFF 기준)
    sc = (stage_cx, stage_cy) if (stage_cx is not None and stage_cy is not None) \
         else estimate_stage_center(bgr, prefer_top_stage=prefer_top_stage)

    gray_thr = estimate_gray_thresholds(bgr, q=gray_chroma_quantile)
    mark_gray_black_textish_flags(bgr, regions, gray_thr)
    regions = [r for r in regions if not r.get("is_textish", False)]

    _tmp_groups = cluster_by_color(regions, COLOR_DELTA)
    for r in regions:
        r["color_group"] = int(_tmp_groups.get(r["id"], -1))

    # 군더더기 억제
    regions = suppress_inner_islands(regions, bgr, area_ratio_thr=0.06, deltaE_thr=10.0)
    regions = suppress_nested_samegroup(regs=regions, area_ratio_thr=0.18, use_color_group=True)
    regions = suppress_subpolys_samegroup_mask(
        regs=regions, img_h=h, img_w=w,
        area_ratio_thr=0.28, outside_frac_thr=0.12, use_color_group=True
    )

    # OCR 기반 스테이지 바운딩 비활성
    # OCR lines removed
    stage_union = None

    # 휴리스틱 추정
    if stage_union is None:
        try:
            from utils_stage import find_stage_by_heuristics
            stage_union = find_stage_by_heuristics(
                regions, img_h=h, img_w=w, bgr=bgr,
                edge_ratio=0.5, min_area_frac=0.002, min_aspect=1.2,
                use_region_flags_first=True
            )
        except Exception:
            stage_union = None

    # 텍스트 중심 추정 (보조)
    if stage_union is None:
        c = detect_stage_text_center(bgr, prefer_top_stage=prefer_top_stage)
        if c is not None:
            cx, cy = c
            s = int(0.08 * min(h, w))
            x = max(0, cx - s // 2); y = max(0, cy - s // 2)
            stage_union = (x, y, min(s, w - x), min(s, h - y))

    # 회색 기반 fallback
    if stage_union is None:
        stage_union = _fallback_stage_from_gray(bgr)

    # 주 스테이지 확정 및 비상호작용 마킹
    primary_stage_id = _resolve_primary_stage_region(regions, stage_union, bgr)
    _mark_stage_overlaps_and_noninteractive(
        regions, stage_union, bgr, primary_stage_id=primary_stage_id,
        area_overlap_thr=0.02, like_stage_deltaE=10.0
    )

    # stage_only 여부 상관없이 합성 STAGE 보장
    maybe_inject_stage_after_mark(
        regions, stage_union, bgr,
        primary_stage_id=primary_stage_id,
        stage_only=stage_only
    )

    # --- 5) 렌더 필터
    ex_ids = set()
    if stage_union is not None:
        sx, sy, sw, sh = stage_union

    for r in regions:
        if r.get("force_render_stage", False):
            continue

        # 작은 순회색 컷
        if strong_gray_exclude and r.get("is_gray", False):
            area = float(r.get("area", 0.0))
            px   = float(w * h)
            gray_ratio = float(r.get("gray_ratio_region", 0.0))
            if (gray_ratio >= 0.998) and (area < px * 0.0008) and (not is_ribbon_like(r, w, h)):
                ex_ids.add(r["id"])
                continue

        # 검정: 리본형 아니면 컷
        if r.get("is_black", False) and (not is_ribbon_like(r, w, h)):
            ex_ids.add(r["id"])
            continue

        # 무대 유사색: 실제 무대 박스와 충분히 겹칠 때만 컷
        if r.get("like_stage_color", False) and stage_union is not None:
            if not is_ribbon_like(r, w, h):
                frac = _overlap_fraction_poly_rect(h, w, r["polygon"], (sx, sy, sw, sh))
                if frac >= 0.10:
                    ex_ids.add(r["id"])

    regions = [r for r in regions if r["id"] not in ex_ids]

    # STAGE 폴리곤 보증(렌더 직전)
    has_stage_poly = any(
        r.get("force_render_stage") or str(r.get("id","")).startswith("poly_STAGE")
        for r in regions
    )
    if (not has_stage_poly) and (stage_union is not None):
        _add_stage_placeholder_if_missing(regions, stage_union, bgr)

    # --- 6) 등급/수용 인원
    stage_poly = _find_stage_poly_from_rendered(regions)
    if stage_poly:
        pts = stage_poly.get("polygon") or stage_poly.get("points")
        stage_ref = _poly_bottom_center(pts) if pts else stage_reference_point(stage_union, sc)
    else:
        stage_ref = stage_reference_point(stage_union, sc)

    assign_levels_and_capacity(
        regions, stage_ref, total_attendees, quartiles, seats_per_component,
        color_delta=COLOR_DELTA, exclude_gray_ids=set(),
        neighbor_gap_px=int(neighbor_gap_px)
    )

    # --- 7) 최종 산출: TSX만 (파일로 저장)
    out_tsx_path = with_ts(RESULT_DIR, img_path.stem, "_v5.tsx")
    tsx_text = write_svg_tsx(
        w, h, regions, out_tsx_path,
        min_render_area=int(min_render_area),
        stage_only=stage_only
    )

    # --- 8) 메타 생성/저장: sections JSON (프론트 소비용)
    try:
        meta_sections = build_sections_json(
            img_path.name,
            regions,
            total_attendees,
            hall_name=hall_name,
        )

        meta_path = (META_DIR / f"{img_path.stem}.json")
        meta_path.write_text(json.dumps(meta_sections, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        # 메타 저장 실패는 파이프라인 실패로 보고 싶다면 raise로 바꿔도 됨
        print("[WARN] meta write failed:", e)


    # 고정 리턴 4-튜플(엔드포인트와 일관)
    pipeline_elapsed = (time.perf_counter() - pipeline_start) * 1000.0
    region_count = len(regions) if "regions" in locals() else 0
    logger.info("image_pipeline done path=%s elapsed=%.1fms regions=%d",
                img_path, pipeline_elapsed, region_count)
    return out_tsx_path, str(meta_path) if 'meta_path' in locals() else None, tsx_text, None


# ----------------------------
# Pipeline endpoints (once)
# ----------------------------

@pipe_router.get("/health")
def health():
    return {"ok": True}

def _maybe_run_internal_pipeline(tmp_img_path: Path, stem: str):
    """
    네 쪽 프로젝트마다 파이프라인 진입점 이름이 다를 수 있어서
    아래 순서로 '있는 함수만' 호출하도록 해둠.
    - _process_image_pipeline(img_path=...)
    - process_image(img_path=...)
    - run_pipeline(img_path=...)
    파이프라인이 자체적으로 OUT_RESULT/OUT_META에 산출물을 저장한다고 가정.
    """
    try:
        glb = globals()
        if "_process_image_pipeline" in glb:
            glb["_process_image_pipeline"](tmp_img_path)
            return
        if "process_image" in glb:
            glb["process_image"](tmp_img_path)
            return
        if "run_pipeline" in glb:
            glb["run_pipeline"](tmp_img_path)
            return
        # 위 함수들이 전혀 없다면, 외부에서 이미 산출해두었다고 보고 그냥 통과
    except Exception as e:
        # 파이프라인 실행 실패는 치명적: 결과물이 없을테니 바로 예외
        raise RuntimeError(f"internal pipeline failed: {e}") from e


def _pick_tsx_and_meta(stem: str) -> tuple[bytes, dict]:
    """
    OUT_RESULT/OUT_META에서 결과물 집계:
    1) {stem}.tsx 가 있으면 그대로 사용
    2) 없고 {stem}.html 이 있으면 TSX로 감싸서 사용
    3) meta.json 은 반드시 필요
    """
    tsx_path  = Path(RESULT_DIR) / f"{stem}.tsx"
    html_path = Path(RESULT_DIR) / f"{stem}.html"
    meta_path = Path(META_DIR)   / f"{stem}.json"

    if not meta_path.exists():
        raise RuntimeError(f"meta json not found: {meta_path}")

    with open(meta_path, "r", encoding="utf-8") as f:
        meta_dict = json.load(f)

    if tsx_path.exists():
        tsx_bytes = tsx_path.read_bytes()
        return tsx_bytes, meta_dict

    if html_path.exists():
        html_str = html_path.read_text(encoding="utf-8")
        # wrap_html_as_tsx 가 유틸에 없다면 아래 최소 래퍼를 사용해도 됨.
        if "wrap_html_as_tsx" in globals():
            tsx_bytes = wrap_html_as_tsx(html_str, comp_name="SeatMap")
        else:
            tsx = f"""
import React from 'react';
export default function SeatMap() {{
  return (
    <div dangerouslySetInnerHTML={{ __html: {json.dumps(html_str)} }} />
  );
}}
""".strip()
            tsx_bytes = tsx.encode("utf-8")
        return tsx_bytes, meta_dict

    raise RuntimeError(f"Neither TSX nor HTML found for stem={stem} (searched: {tsx_path}, {html_path})")

@pipe_router.post("/process_tsx")
async def process_html(
    file: UploadFile = File(...),
    capacity: int = Form(...),
    hall_name: Optional[str] = Form(None),
):
    """
    업로드된 이미지 처리 → 내부 파이프라인 실행(TSX + meta 생성) → /halls → MinIO 업로드
    리턴: { ok, hallId, minio: { tsx, meta }, local: { tsx, meta }, warn?: [] }
    """
    total_start = time.perf_counter()
    stage_times: list[tuple[str, float]] = []
    raw_hall_name = (hall_name or "").strip()
    safe_hall_stem = re.sub(r"[^0-9A-Za-z._\-\uAC00-\uD7A3]+", "_", raw_hall_name) if raw_hall_name else ""
    safe_hall_stem = safe_hall_stem.strip("_") or safe_hall_stem
    if not safe_hall_stem:
        safe_hall_stem = os.path.splitext(file.filename)[0]

    def _mark(name: str, started: float) -> None:
        stage_times.append((name, (time.perf_counter() - started) * 1000.0))

    try:
        # 0) 업로드 저장(원본)
        data_dir = Path(os.environ.get("OUT_DATA_DIR", "/mnt/data/STH_v1/data"))
        data_dir.mkdir(parents=True, exist_ok=True)
        stem = safe_hall_stem
        tmp_img_path = data_dir / file.filename
        t = time.perf_counter()
        tmp_bytes = await file.read()
        tmp_img_path.write_bytes(tmp_bytes)
        _mark("write_upload", t)

        # 1) 파이프라인 실행 → TSX, meta.json 생성
        t = time.perf_counter()
        tsx_path, meta_path, tsx_text, _ = _process_image_pipeline(
            tmp_img_path,
            total_attendees=capacity if capacity is not None else None,
            hall_name=raw_hall_name or safe_hall_stem,
        )
        _mark("image_pipeline", t)

        # 2) TSX 바이트 확보
        t = time.perf_counter()
        tsx_bytes = (
            tsx_text.encode("utf-8") if isinstance(tsx_text, str)
            else (Path(tsx_path).read_bytes() if tsx_path else b"")
        )
        if not tsx_bytes:
            raise HTTPException(status_code=500, detail="Empty TSX output")
        _mark("prepare_tsx_bytes", t)

        # 3) meta.json 로드 (없으면 최소 메타)
        t = time.perf_counter()
        if meta_path and Path(meta_path).exists():
            meta_dict = json.loads(Path(meta_path).read_text(encoding="utf-8"))
        else:
            meta_dict = {
                "name": stem,
                "sections": [],
                "imageSize": None,
                "stageCenter": None,
                "stageBBox": None,
                "note": "fallback meta (no sections)"
            }
        _mark("load_meta", t)

        # 4) 퍼블리시: Halls 등록 → MinIO 업로드(재시도+폴백)
        t = time.perf_counter()
        publish_info = await _finalize_and_publish(
            src_filename=file.filename,
            capacity=capacity,
            tsx_bytes=tsx_bytes,
            meta_dict=meta_dict,
            hall_name=raw_hall_name or safe_hall_stem,
            object_stem=safe_hall_stem,
        )
        _mark("finalize_publish", t)

        # 5) 응답
        resp = {
            "ok": True,
            "hallId": publish_info["hallId"],
            "minio": publish_info["minio"],  # { tsx: {bucket,key,url}|None, meta: {...}|None }
            "local": publish_info["local"],  # { tsx: {path,saved}, meta: {path,saved} }
        }
        if publish_info.get("warn"):
            resp["warn"] = publish_info["warn"]

        total_elapsed = (time.perf_counter() - total_start) * 1000.0
        summary = ", ".join(f"{name}={elapsed:.1f}ms" for name, elapsed in stage_times)
        logger.info("process_tsx done file=%s total=%.1fms stages=[%s]", file.filename, total_elapsed, summary)
        return resp

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ----------------------------
# Root & include routers
# ----------------------------

@app.get("/")
def root():
    return {
        "app": "STH_v1 Modular FastAPI (B-plan + stage-fallback)",
        "data_dir": str(DATA_DIR),
        "result_dir": str(RESULT_DIR),
        "meta_dir": str(META_DIR),
        "docs": "/docs",
        "routers": ["/fg", "/text", "/segment", "/stage", "/analyze", "/assign", "/render", "/pipeline", "/files"]
    }

app.include_router(fg_router)
app.include_router(text_router)
app.include_router(seg_router)
app.include_router(stage_router)
app.include_router(analy_router)
app.include_router(assign_router)
app.include_router(render_router)
app.include_router(pipe_router)
app.include_router(files_router)

# Run:
#   uvicorn main_modular:app --host 0.0.0.0 --port 8000 --reload
# Swagger:
#   http://localhost:8000/docs
