# main_modular.py
# -*- coding: utf-8 -*-
# Modular FastAPI: 단계별 API + 통합 파이프라인 (B안 규칙 + OCR 라벨 오버레이 + pretty/디버그 HTML)
# 핵심 규칙:
#  - color_delta = 22 고정
#  - 텍스트형 폴리곤 제거
#  - 회색/검정 기본 렌더 제외, 단 "STAGE"와 겹치면 강제 렌더(등급 산정 제외)
#  - 폴리곤이 너무 작으면 렌더링 제외(min_render_area)
#  - OCR 실패 시 템플릿 기반 fallback STAGE 박스 합성
#  - STAGE 좌표와 겹치는 폴리곤은 색상과 무관하게 비상호작용 처리
#  - 색상 그룹 수에 따른 레벨 매핑: 2=VIP,R / 3=VIP,R,S / 4+=STANDING,VIP,R,S

from __future__ import annotations
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
import os, re, json, math
import numpy as np
import cv2
from fastapi import FastAPI, APIRouter, UploadFile, File, Form, Response, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

try:
    import httpx
except ImportError:
    httpx = None

OCR_AVAILABLE = httpx is not None

# ----------------------------
# Paths / Dirs
# ----------------------------
BASE_DIR   = Path("/mnt/data")
DATA_DIR   = BASE_DIR / "STH_v1" / "data"
RESULT_DIR = BASE_DIR / "result"
META_DIR   = BASE_DIR / "meta"
DEBUG_DIR  = BASE_DIR / "debug"
for d in (DATA_DIR, RESULT_DIR, META_DIR, DEBUG_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ----------------------------
# App & Routers
# ----------------------------
app = FastAPI(title="STH_v1 Modular FastAPI (B-plan + OCR overlay + stage-fallback)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)
fg_router      = APIRouter(prefix="/fg", tags=["1. Foreground / Background"])
text_router    = APIRouter(prefix="/text", tags=["2. Text removal / Stage text"])
seg_router     = APIRouter(prefix="/segment", tags=["3. Segmentation"])
stage_router   = APIRouter(prefix="/stage", tags=["4. Stage center"])
analy_router   = APIRouter(prefix="/analyze", tags=["5. Gray/Mix & Grouping"])
assign_router  = APIRouter(prefix="/assign", tags=["6. Level/Capacity"])
render_router  = APIRouter(prefix="/render", tags=["7. Render"])
files_router   = APIRouter(prefix="/files", tags=["Files / Downloads"])
pipe_router    = APIRouter(prefix="/pipeline", tags=["Pipeline (integrated)"])

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
OCR_ENDPOINT      = os.environ.get("OCR_ENDPOINT", "http://localhost:8100/ocr/extract")
OCR_MIN_SCORE     = float(os.environ.get("OCR_MIN_SCORE", "0.35"))
STAGE_KEYWORDS    = ["stage", "무대", "스테이지"]  # 정규화 후 포함 매칭
STAGE_OVERLAP_IOU = 0.0001  # 살짝만 겹쳐도 무대 강제 렌더
STAGE_DELE_THR    = 12.0    # ΔE 임계 (무대색 유사)

# 렌더 최소 면적
DEFAULT_MIN_RENDER_AREA = 450

# 컬러 그룹 범례 ON / OFF
SHOW_COLOR_LEGEND = False


# ----------------------------
# Fixed pipeline defaults
# ----------------------------
PIPELINE_DEFAULTS = {
    "crop_legend": False,
    "ensemble": True,
    "min_area": None,
    "iou_merge_thr": 0.65,
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
    "use_external_ocr": False,
    "ocr_min_score": 0.5,
    "ocr_mask_dilate": 2,
    "min_render_area": DEFAULT_MIN_RENDER_AREA,
    "use_ocr_for_stage": True,
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

def kmeans_colors(X: np.ndarray, k: int = 2, attempts: int = 3):
    X = np.float32(X.reshape(-1, 3))
    if X.shape[0] < k:
        k = max(1, min(k, X.shape[0]))
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 80, 0.15)
    _compactness, labels, centers = cv2.kmeans(
        X, k, None, criteria, attempts, cv2.KMEANS_PP_CENTERS
    )
    return labels.reshape(-1), centers

def polygon_area(pts):
    pts = np.asarray(pts, dtype=np.float32)
    x, y = pts[:, 0], pts[:, 1]
    return 0.5 * np.abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))

def polygon_centroid(pts) -> Tuple[float, float]:
    pts = np.asarray(pts, dtype=np.float64)
    A = polygon_area(pts)
    if A == 0:
        return float(pts[:, 0].mean()), float(pts[:, 1].mean())
    x = pts[:, 0]; y = pts[:, 1]
    c = (x * np.roll(y, -1) - np.roll(x, -1) * y)
    cx = (1.0 / (6.0 * A)) * np.sum((x + np.roll(x, -1)) * c)
    cy = (1.0 / (6.0 * A)) * np.sum((y + np.roll(y, -1)) * c)
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

# ----------------------------
# Auto / thresholds
# ----------------------------
def auto_min_area(h: int, w: int) -> int:
    return int(max(450, 0.00012 * h * w))

def estimate_gray_thresholds(img_bgr: np.ndarray, q: float = LAB_GRAY_Q) -> Dict[str, float]:
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    a = np.abs(lab[:, :, 1] - 128.0)
    b = np.abs(lab[:, :, 2] - 128.0)
    chroma = np.sqrt(a * a + b * b)
    chroma_thr = float(np.quantile(chroma.reshape(-1), q)) + 3.0
    return {"chroma_thr": chroma_thr, "L_low": LAB_L_LOW, "L_high": LAB_L_HIGH}

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
    mask = cv2.maximum(mask, cv2.dilate(edges, np.ones((2, 2), np.uint8), 1))
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
# Grouping / Levels
# ----------------------------
def compute_neighbors(regions: List[Dict[str, Any]], px_gap: float) -> Dict[str, List[str]]:
    def _overlap(exp_a, exp_b):
        ax, ay, aw, ah = exp_a
        bx, by, bw, bh = exp_b
        ax2, ay2 = ax + aw, ay + ah
        bx2, by2 = bx + bw, by + bh
        return not (ax2 < bx or bx2 < ax or ay2 < by or by2 < ay)

    bboxes: Dict[str, List[float]] = {}
    for r in regions:
        rid = str(r["id"])
        x, y, w, h = r["bbox"]
        bboxes[rid] = [x - px_gap, y - px_gap, w + 2 * px_gap, h + 2 * px_gap]

    neigh: Dict[str, List[str]] = {str(r["id"]): [] for r in regions}

    n = len(regions)
    for i in range(n):
        ra = regions[i]
        ra_id = str(ra["id"])
        for j in range(i + 1, n):
            rb = regions[j]
            rb_id = str(rb["id"])
            if _overlap(bboxes[ra_id], bboxes[rb_id]):
                neigh[ra_id].append(rb_id)
                neigh[rb_id].append(ra_id)
    return neigh

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
        med = float(np.median(v["dists"])) if v["dists"] else 0.0
        mean_lab = np.mean(np.stack(v["labs"]), axis=0) if v["labs"] else np.array([0, 0, 0], dtype=np.float32)
        bgr = cv2.cvtColor(mean_lab.astype(np.uint8).reshape(1, 1, 3), cv2.COLOR_Lab2BGR).reshape(3, )
        summary.append({
            "group": int(g),
            "count": int(v["count"]),
            "median_distance": round(med, 2),
            "mean_lab": [float(mean_lab[0]), float(mean_lab[1]), float(mean_lab[2])],
            "repr_hex": to_hex(bgr)
        })
    summary.sort(key=lambda x: x["median_distance"])
    return summary

def _map_level_names_by_group_count(sorted_group_ids: List[int]) -> Dict[int, str]:
    n = len(sorted_group_ids)
    if n <= 1:
        names = ["STANDING"]
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
    exclude_gray_ids: Optional[set] = None,
    neighbor_gap_px: int = 12
):
    sx, sy = stage_center
    for r in regions:
        cx, cy = r["centroid"]
        r["distance_to_stage"] = float(math.hypot(cx - sx, cy - sy))

    neigh = compute_neighbors(regions, px_gap=max(2, neighbor_gap_px))
    for r in regions:
        r["neighbors"] = neigh[r["id"]]

    def _excluded(r):
        if exclude_gray_ids and r["id"] in exclude_gray_ids:
            return True
        if r.get("exclude_from_level", False):
            return True
        if r.get("is_gray", False) or r.get("is_black", False):
            return True
        return False

    valid_regs = [r for r in regions if not _excluded(r)]

    color_groups = cluster_by_color(valid_regs, color_delta)
    for r in regions:
        r["color_group"] = int(color_groups.get(r["id"], -1))

    by_group: Dict[int, List[float]] = {}
    for r in valid_regs:
        g = r["color_group"]
        if g < 0:
            continue
        by_group.setdefault(g, []).append(r["distance_to_stage"])

    order = sorted(by_group.keys(), key=lambda g: float(np.median(by_group[g])))

    mapping = _map_level_names_by_group_count(order)

    for r in regions:
        if r in valid_regs and r["color_group"] in mapping:
            r["seat_level"] = mapping[r["color_group"]]
        else:
            r["seat_level"] = ""

    dists = np.array([r["distance_to_stage"] for r in valid_regs], dtype=np.float32)
    if len(dists) > 0:
        q1, q2, q3 = np.quantile(dists, quartiles).tolist()
        for r in regions:
            r["ring_index"] = int(0 if r["distance_to_stage"] <= q1 else 1 if r["distance_to_stage"] <= q2 else 2 if r["distance_to_stage"] <= q3 else 3)

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
                    if caps[idx] > 0: caps[idx] -= 1; diff += 1
                i = (i + 1) % len(order_idx)
        for r, c in zip(regions, caps):
            r["capacity"] = int(max(0, c))
            r["component_count"] = int(max(1, math.ceil(r["capacity"] / max(1, seats_per_component))))
    else:
        for r in regions:
            r["capacity"] = None
            r["component_count"] = None

# ----------------------------
# OCR helpers (STAGE)
# ----------------------------
def call_ocr_extract_bgr(img_bgr: np.ndarray) -> List[Dict[str, Any]]:
    if httpx is None:
        print("[OCR] httpx not available → skip")
        return []
    ok, buf = cv2.imencode(".png", img_bgr)
    if not ok:
        return []
    files = {"file": ("image.png", buf.tobytes(), "image/png")}
    data = {"min_score": str(OCR_MIN_SCORE), "return_mask": "false"}
    try:
        r = httpx.post(OCR_ENDPOINT, files=files, data=data, timeout=30)
        r.raise_for_status()
        js = r.json()
        print(f"[OCR] lines={len(js.get('lines', []))}")
        return js.get("lines", [])
    except Exception as e:
        print(f"[OCR] request failed: {e}")
        return []

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

def normalize_ocr_lines(lines_raw: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out = []
    for ln in lines_raw:
        poly = ln.get("poly") or []
        if not poly:
            continue
        xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
        x, y = min(xs), min(ys)
        w, h = max(xs) - x, max(ys) - y
        cx = int(sum(xs) / len(xs)); cy = int(sum(ys) / len(ys))
        out.append({
            "text": ln.get("text", ""),
            "score": float(ln.get("score", 0.0)),
            "poly": [[int(px), int(py)] for px, py in poly],
            "bbox": [int(x), int(y), int(w), int(h)],
            "cx": int(cx), "cy": int(cy)
        })
    return out

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
def _add_stage_placeholder_if_missing(regions: List[Dict[str, Any]],
                                      stage_union_xywh: Optional[Tuple[int, int, int, int]],
                                      bgr: np.ndarray) -> None:
    if not stage_union_xywh:
        return
    if any(str(r.get("id","")).startswith("poly_STAGE") for r in regions):
        return

    x, y, w, h = stage_union_xywh
    if w <= 0 or h <= 0:
        return

    if any(bbox_iou_xywh(tuple(map(int, r["bbox"])), (int(x), int(y), int(w), int(h))) >= STAGE_OVERLAP_IOU
           for r in regions):
        return

    H, W = bgr.shape[:2]
    x = max(0, min(W - 1, int(x))); y = max(0, min(H - 1, int(y)))
    w = max(1, min(W - x, int(w))); h = max(1, min(H - y, int(h)))

    poly = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
    poly_np = np.array(poly, np.int32)
    area = float(cv2.contourArea(poly_np))
    if area <= 1:
        return

    lab = cv2.cvtColor(bgr[y:y+h, x:x+w], cv2.COLOR_BGR2LAB).astype(np.float32)
    med_lab = np.median(lab.reshape(-1, 3), axis=0)
    med_bgr = cv2.cvtColor(med_lab.astype(np.uint8).reshape(1, 1, 3), cv2.COLOR_Lab2BGR).reshape(3,)
    fill_hex = to_hex(med_bgr)
    cx, cy = x + w / 2.0, y + h / 2.0

    regions.append({
        "id": "poly_STAGE",
        "polygon": poly,
        "bbox": [int(x), int(y), int(w), int(h)],
        "centroid": [float(cx), float(cy)],
        "area": area,
        "perimeter": float(cv2.arcLength(poly_np, True)),
        "fill": fill_hex,
        "lab_med": [float(med_lab[0]), float(med_lab[1]), float(med_lab[2])],
        "two_color_mix": None,
        "force_render_stage": True,
        "exclude_from_level": True,
        "non_interactive_stage": True
    })

def _overlap_fraction_poly_rect(h: int, w: int, poly: List[List[int]], rect_xywh: Tuple[int,int,int,int]) -> float:
    m_poly = mask_from_polygon(h, w, poly)
    x, y, rw, rh = rect_xywh
    m_rect = np.zeros((h, w), np.uint8)
    cv2.rectangle(m_rect, (int(x), int(y)), (int(x+rw), int(y+rh)), 255, -1)
    inter = cv2.countNonZero(cv2.bitwise_and(m_poly, m_rect))
    area_poly = cv2.countNonZero(m_poly)
    return (inter / area_poly) if area_poly > 0 else 0.0

def _mark_stage_overlaps_and_noninteractive(regions, stage_union_xywh, bgr):
    for r in regions:
        r["force_render_stage"]   = bool(r.get("force_render_stage", False))
        r["exclude_from_level"]   = bool(r.get("exclude_from_level", False))
        r["non_interactive_stage"]= bool(r.get("non_interactive_stage", False))
        r["like_stage_color"]     = bool(r.get("like_stage_color", False))

    if not stage_union_xywh:
        return

    x, y, w, h = stage_union_xywh
    H, W = bgr.shape[:2]
    x = max(0, min(W - 1, int(x))); y = max(0, min(H - 1, int(y)))
    w = max(1, min(W - x, int(w))); h = max(1, min(H - y, int(h)))

    lab_roi   = cv2.cvtColor(bgr[y:y+h, x:x+w], cv2.COLOR_BGR2LAB).astype(np.float32)
    stage_lab = np.median(lab_roi.reshape(-1, 3), axis=0)

    for r in regions:
        bx, by, bw, bh = [int(t) for t in r["bbox"]]
        # A) bbox 기준으로 충분히 겹치면 완전 비상호작용
        if bbox_iou_xywh((bx, by, bw, bh), (x, y, w, h)) >= STAGE_OVERLAP_IOU:
            r["force_render_stage"]   = True
            r["exclude_from_level"]   = True
            r["non_interactive_stage"]= True
            continue

        # B) 색상 유사하더라도, 무대 사각형과 실제 겹침 비율이 작으면 인터랙션 유지
        lab_med = np.array(r.get("lab_med", [0, 0, 0]), dtype=np.float32)
        if deltaE_lab(lab_med, stage_lab) <= STAGE_DELE_THR:
            r["like_stage_color"] = True
            frac = _overlap_fraction_poly_rect(H, W, r["polygon"], (x, y, w, h))
            if frac >= 0.02:
                r["non_interactive_stage"] = True

# ----------------------------
# HTML Render (pretty + OCR overlay)
# ----------------------------
def _legend_html(color_summary: List[Dict[str, Any]], note: str) -> str:
    rows = []
    for item in color_summary:
        rows.append(
            "\n".join([
                "        <div class='row'>",
                f"          <span class='sw' style='background:{item['repr_hex']}'></span>",
                f"          <span class='txt'>G{item['group']} · {item['repr_hex']} · n={item['count']} · medD={item['median_distance']}</span>",
                "        </div>",
            ])
        )
    if not rows:
        rows.append("        <div class='empty'>No color groups</div>")
    return "\n".join([
        "      <div class='legend'>",
        "        <div class='title'>Color Groups (by stage distance)</div>",
        *rows,
        f"        <div class='note'>{note}</div>",
        "      </div>",
    ])

def _escape_html(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def write_svg_html(
    img_bgr,
    regions,
    out_html: Path,
    *,
    opacity=0.95,
    color_summary: Optional[List[Dict[str, Any]]] = None,
    debug_imgs: Optional[List[np.ndarray]] = None,
    min_render_area: int = DEFAULT_MIN_RENDER_AREA,
    ocr_lines: Optional[List[Dict[str, Any]]] = None
):
    h, w = img_bgr.shape[:2]

    def _should_render(r: Dict[str, Any]) -> bool:
        if r.get("force_render_stage", False):
            return True
        if r["area"] < float(min_render_area):
            return False
        if r.get("is_textish", False):
            return False
        if (r.get("is_gray", False) or r.get("is_black", False)) and not r.get("force_render_stage", False):
            return False
        return True

    render_regions = [r for r in regions if _should_render(r)]

    defs = []
    for r in render_regions:
        mix = (r.get("two_color_mix") or {})
        if mix.get("is_mixed"):
            pid = "pat_" + r["id"]
            c0, c1 = mix["hex_colors"]
            defs.append("\n".join([
                f"      <pattern id='{pid}' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'>",
                f"        <rect width='8' height='8' fill='{c0}'/>",
                f"        <rect width='4' height='8' fill='{c1}'/>",
            ]))
    defs_html = "    <defs>\n" + "\n".join(defs) + "\n    </defs>" if defs else ""

    polys_html = []
    for r in render_regions:
        pts = " ".join(f"{x},{y}" for x, y in r["polygon"])
        interactive = True
        if r.get("non_interactive_stage", False):
            interactive = False
        elif (r.get("is_gray", False) or r.get("is_black", False) or r.get("is_textish", False)) and not r.get("force_render_stage", False):
            interactive = False

        attr = {
            "data-id": r["id"],
            "data-fill": r["fill"],
            "data-seat-level": r.get("seat_level", ""),
            "data-capacity": r.get("capacity", ""),
            "data-component-count": r.get("component_count", ""),
            "data-ratio": r.get("ratio", ""),
            "data-color-group": r.get("color_group", ""),
            "data-non-interactive": "1" if r.get("non_interactive_stage", False) else "0",
        }
        data_attr = " ".join(f'{k}="{attr[k]}"' for k in attr)
        mix = (r.get("two_color_mix") or {})
        fill_val = f"url(#pat_{r['id']})" if mix.get("is_mixed") else r["fill"]
        style = "" if interactive else "pointer-events:none;"
        polys_html.append("\n".join([
            f'      <polygon points="{pts}"',
            f'               fill="{fill_val}"',
            f'               style="{style}"',
            f'               fill-opacity="{opacity}" stroke="#222" stroke-opacity="0.55" stroke-width="1" {data_attr}></polygon>',
        ]))

    svg_parts = [
        f'    <svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" xmlns="http://www.w3.org/2000/svg">',
        defs_html if defs_html else "",
        *polys_html,
        "    </svg>",
    ]
    svg = "\n".join([p for p in svg_parts if p != ""])

    legend_html = ""
    if SHOW_COLOR_LEGEND and (color_summary or []):
        legend_html = _legend_html(
            color_summary,
            "Levels: 2=VIP·R, 3=VIP·R·S, 4+=STANDING·VIP·R·S. Gray/Black hidden unless overlapping STAGE."
        )   
    ocr_divs = []
    if ocr_lines:
        for ln in ocr_lines:
            cx, cy = int(ln.get("cx", 0)), int(ln.get("cy", 0))
            txt = _escape_html(str(ln.get("text", "")))
            ocr_divs.append(f'      <div class="ocr-label" style="left:{cx}px; top:{cy}px;">{txt}</div>')
    ocr_layer_html = "\n".join([
        '    <div class="ocr-layer">',
        *ocr_divs,
        '    </div>'
    ]) if ocr_divs else ""

    script = "\n".join([
        "    <script>",
        "      const tip=document.createElement('div');",
        "      tip.style.position='fixed';",
        "      tip.style.pointerEvents='none';",
        "      tip.style.padding='6px 8px';",
        "      tip.style.background='rgba(0,0,0,0.75)';",
        "      tip.style.color='#fff';",
        "      tip.style.font='12px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial';",
        "      tip.style.borderRadius='6px';",
        "      tip.style.boxShadow='0 2px 8px rgba(0,0,0,.25)';",
        "      tip.style.zIndex='9999';",
        "      tip.style.transform='translate(-50%,-140%)';",
        "      tip.style.display='none';",
        "      document.body.appendChild(tip);",
        "      function showTip(e,p){",
        "        const lv=p.dataset.seatLevel||''; const id=p.dataset.id||'';",
        "        tip.textContent=(lv&&id)?(lv+' • '+id):(lv||id);",
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
        "        const p=e.target.closest('polygon');",
        "        if(!p) return;",
        "        if(getComputedStyle(p).pointerEvents==='none') return;",
        "        const d={",
        "          id:p.dataset.id, level:p.dataset.seatLevel, group:p.dataset.colorGroup,",
        "          capacity:p.dataset.capacity, components:p.dataset.componentCount,",
        "          ratio:p.dataset.ratio, fill:p.dataset.fill",
        "        };",
        "        console.log('[seat-click]', d);",
        "      });",
        "    </script>",
    ])

    debug_panel = ""
    if debug_imgs:
        debug_panel = "    <div class='dbg-note'>Debug thumbnails saved alongside outputs.</div>"

    style = "\n".join([
        "    <style>",
        "      body{margin:0;background:#fff}",
        "      .wrapper{display:flex;align-items:center;justify-content:center;padding:16px}",
        "      .card{background:#fff;padding:8px;position:relative}",
        "      svg{display:block}",
        "      svg polygon{transition:stroke-width .1s ease}",
        "      svg polygon:hover{stroke:#000;stroke-width:2;cursor:pointer}",
        "      .legend{position:fixed;right:12px;top:12px;background:#fff;border:1px solid #eee;border-radius:8px;padding:10px 12px;box-shadow:0 4px 16px rgba(0,0,0,.08);font:12px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial}",
        "      .legend .title{font-weight:600;margin-bottom:6px}",
        "      .legend .row{display:flex;align-items:center;gap:8px;margin:4px 0}",
        "      .legend .row .sw{display:inline-block;width:16px;height:12px;border-radius:3px;border:1px solid rgba(0,0,0,.15)}",
        "      .legend .row .txt{color:#111}",
        "      .legend .empty{color:#888}",
        "      .legend .note{margin-top:6px;color:#666}",
        "      .dbg-note{position:fixed;left:12px;bottom:12px;color:#666;font:12px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial}",
        "      .canvas-wrap{position:relative;display:inline-block}",
        "      .ocr-layer{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}",
        "      .ocr-label{position:absolute;transform:translate(-50%,-50%);",
        "        font:700 13px/1.1 \"Malgun Gothic\",\"Apple SD Gothic Neo\",\"Noto Sans KR\",sans-serif;",
        "        color:#111;background:#fff;padding:2px 4px;border-radius:4px;",
        "        border:1px solid rgba(0,0,0,.12);white-space:nowrap;pointer-events:none}",
        "    </style>",
    ])

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
        f"{ocr_layer_html}",
        "        </div>",
        "      </div>",
        "    </div>",
        f"{legend_html}",
        f"{debug_panel}",
        f"{script}",
        "  </body>",
        "</html>",
    ]
    html = "\n".join(html_parts)
    out_html.write_text(html, encoding="utf-8")
    return html

# ----------------------------
# Debug HTML (폴리곤/스테이지/OCR 간단 시각화)
# ----------------------------
import base64 as _b64
import html as _py_html

def _bgr_to_data_url_png(img_bgr: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", img_bgr)
    if not ok:
        return ""
    b64 = _b64.b64encode(buf.tobytes()).decode("ascii")
    return f"data:image/png;base64,{b64}"

def _build_regions_debug_html(
    *,
    img_bgr: np.ndarray,
    regions: List[Dict[str, Any]],
    stage_center: Optional[Tuple[int,int]],
    stage_union_xywh: Optional[Tuple[int,int,int,int]],
    ocr_lines_norm: Optional[List[Dict[str,Any]]],
    title: str = "Seatmap Regions Debug",
) -> str:
    h, w = img_bgr.shape[:2]
    data_url = _bgr_to_data_url_png(img_bgr)

    svg_polys = []
    for r in regions:
        pts = " ".join(f"{int(x)},{int(y)}" for x, y in r.get("polygon", []))
        if not pts:
            continue
        cls = []
        if r.get("non_interactive_stage"): cls.append("noninter")
        if r.get("force_render_stage"):    cls.append("force")
        if r.get("is_gray"):               cls.append("gray")
        if r.get("is_black"):              cls.append("black")
        if r.get("is_textish"):            cls.append("textish")
        if r.get("like_stage_color"):      cls.append("like-stage")
        lv = r.get("seat_level","")
        if lv: cls.append(f"lv-{lv}")
        cstr = " ".join(cls) if cls else "poly"
        svg_polys.append(
            f'<polygon class="poly {cstr}" points="{pts}" '
            f'data-id="{_escape_html(r.get("id",""))}" '
            f'data-level="{_escape_html(lv)}" '
            f'data-group="{_escape_html(str(r.get("color_group","")))}" '
            f'data-area="{_escape_html(str(int(r.get("area",0))))}" '
            f'style="fill:{r.get("fill","#9ecbff")}; fill-opacity:0.18; stroke:#7ec8ff; stroke-width:1" />'
        )

    stage_overlay = []
    if stage_center:
        cx, cy = stage_center
        stage_overlay.append(f'<circle cx="{cx}" cy="{cy}" r="8" class="stage-center"/>')
    if stage_union_xywh:
        x, y, sw, sh = [int(v) for v in stage_union_xywh]
        stage_overlay.append(f'<rect x="{x}" y="{y}" width="{sw}" height="{sh}" class="stage-bbox"/>')

    ocr_divs = []
    if ocr_lines_norm:
        for it in ocr_lines_norm:
            cx, cy = int(it.get("cx",0)), int(it.get("cy",0))
            txt = _escape_html(str(it.get("text","")))
            ocr_divs.append(f'<div class="ocr" style="left:{cx}px;top:{cy}px">{txt}</div>')

    head = "<tr><th>#</th><th>id</th><th>level</th><th>area</th><th>non-inter</th><th>gray</th><th>black</th><th>textish</th><th>like-stage</th></tr>"
    rows = []
    for i, r in enumerate(regions):
        rows.append(
            "<tr>"
            f"<td>{i}</td>"
            f"<td>{_escape_html(r.get('id',''))}</td>"
            f"<td>{_escape_html(r.get('seat_level',''))}</td>"
            f"<td>{int(r.get('area',0))}</td>"
            f"<td>{'✅' if r.get('non_interactive_stage') else ''}</td>"
            f"<td>{'✅' if r.get('is_gray') else ''}</td>"
            f"<td>{'✅' if r.get('is_black') else ''}</td>"
            f"<td>{'✅' if r.get('is_textish') else ''}</td>"
            f"<td>{'✅' if r.get('like_stage_color') else ''}</td>"
            "</tr>"
        )
    json_dump = json.dumps(
        {
            "image_size": {"w": w, "h": h},
            "stage_center": stage_center,
            "stage_union_xywh": stage_union_xywh,
            "ocr_lines": ocr_lines_norm,
            "regions": regions,
        },
        ensure_ascii=False, indent=2
    )

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>{_py_html.escape(title)}</title>
  <style>
    body {{ margin:0; background:#0b1020; color:#eaf2ff; font:13px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,"Noto Sans KR"; }}
    .wrap {{ display:flex; gap:16px; padding:16px; }}
    .canvas {{ position:relative; width:{w}px; height:{h}px; border:1px solid #26325e; border-radius:10px; overflow:hidden; }}
    .canvas img {{ position:absolute; inset:0; width:100%; height:100%; object-fit:contain; }}
    .canvas svg {{ position:absolute; inset:0; width:100%; height:100%; }}
    .poly {{ fill-opacity:.18; stroke-width:1; }}
    .poly.noninter {{ stroke:#ffa2a2; }}
    .poly.force    {{ fill-opacity:.28; stroke:#fff1a2; }}
    .poly.gray     {{ stroke:#8fa0b7; }}
    .poly.black    {{ stroke:#666; }}
    .poly.textish  {{ stroke:#ffaa44; stroke-dasharray:5 4; }}
    .poly.like-stage {{ stroke:#ff7f9f; }}
    .stage-center {{ fill:#ff5577; stroke:#ffd5de; stroke-width:2; opacity:.95; }}
    .stage-bbox {{ fill:none; stroke:#ffb2c0; stroke-width:2; stroke-dasharray:6 4; }}
    .ocr {{ position:absolute; transform:translate(-50%,-120%); padding:2px 6px; background:rgba(0,0,0,.55);
            border:1px solid #3a4b7a; border-radius:6px; font-size:12px; white-space:nowrap; pointer-events:none; }}
    .panel {{ min-width:440px; max-width:560px; background:#0f1630; border:1px solid #26325e; border-radius:12px; padding:12px; }}
    .panel h2 {{ margin:6px 0 10px; font-size:16px; color:#cfe2ff; }}
    table {{ border-collapse:collapse; width:100%; font-size:12px; }}
    th,td {{ border:1px solid #2a335a; padding:6px 8px; }}
    pre {{ max-height:420px; overflow:auto; background:#0b1020; border:1px solid #1c2446; padding:10px; border-radius:8px; }}
    .controls {{ display:flex; gap:8px; margin-bottom:8px; }}
    button {{ background:#1a2448; color:#eaf2ff; border:1px solid #2a335a; border-radius:8px; padding:6px 10px; cursor:pointer; }}
    button:hover {{ background:#263263; }}
    .hidden {{ display:none; }}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="canvas" id="canvas">
      <img src="{data_url}" alt="image"/>
      <svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg">
        {"".join(svg_polys)}
        {"".join(stage_overlay)}
      </svg>
      {"".join(ocr_divs)}
    </div>
    <div class="panel">
      <h2>폴리곤 인식 디버그</h2>
      <div class="controls">
        <button onclick="togJson()">JSON 보기/숨기기</button>
        <button onclick="togOCR()">OCR 토글</button>
        <button onclick="togStage()">Stage 토글</button>
      </div>
      <table>{head}{"".join(rows)}</table>
      <pre id="json" class="hidden">{_py_html.escape(json_dump)}</pre>
    </div>
  </div>
  <script>
    function togJson(){{ const el=document.getElementById('json'); el.classList.toggle('hidden'); }}
    function togOCR(){{ document.querySelectorAll('.ocr').forEach(e=>{{ e.style.display=(e.style.display==='none')?'':'none'; }}); }}
    function togStage(){{
      document.querySelectorAll('.stage-center,.stage-bbox').forEach(e=>{{ e.style.display=(e.style.display==='none')?'':'none'; }});
    }}
  </script>
</body>
</html>
"""

def write_regions_debug_html(
    out_path: Path,
    *,
    img_bgr: np.ndarray,
    regions: List[Dict[str,Any]],
    stage_center: Optional[Tuple[int,int]],
    stage_union_xywh: Optional[Tuple[int,int,int,int]],
    ocr_lines_norm: Optional[List[Dict[str,Any]]]
) -> str:
    html_text = _build_regions_debug_html(
        img_bgr=img_bgr,
        regions=regions,
        stage_center=stage_center,
        stage_union_xywh=stage_union_xywh,
        ocr_lines_norm=ocr_lines_norm,
        title=f"Seatmap Regions Debug · {out_path.stem}"
    )
    out_path.write_text(html_text, encoding="utf-8")
    return html_text

# ----------------------------
# (Optional) External OCR hook
# ----------------------------
OCR_API_URL = os.environ.get("OCR_API_URL", "http://localhost:8100")

def call_ocr_extract_path(img_path: str, min_score: float = 0.5, mask_dilate: int = 2):
    if httpx is None:
        raise RuntimeError("httpx not installed. Install httpx to use external OCR.")
    url = f"{OCR_API_URL}/ocr/extract"
    with open(img_path, "rb") as f:
        files = {"file": (Path(img_path).name, f, "image/png")}
        data  = {"min_score": str(min_score), "return_mask": "true", "mask_dilate": str(mask_dilate)}
        r = httpx.post(url, files=files, data=data, timeout=60)
        r.raise_for_status()
        return r.json()

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
    iou_merge_thr: float = Form(0.65),
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
        min_area = auto_min_area(h, w)

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
    regions = [r for r in regions if not r.get("is_textish", False)]

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
    color_summary = _color_group_summary([r for r in regions if r["seat_level"]])
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
    min_render_area: int = Form(DEFAULT_MIN_RENDER_AREA),
    ocr_lines_json: str = Form("[]")
):
    in_path = DATA_DIR / file.filename
    with open(in_path, "wb") as f:
        f.write(await file.read())
    bgr = cv2.imread(str(in_path), cv2.IMREAD_COLOR)
    if bgr is None:
        return JSONResponse({"ok": False, "error": "invalid image"}, status_code=400)
    regions = json.loads(regions_json)
    color_summary = json.loads(color_summary_json)
    ocr_lines = json.loads(ocr_lines_json)
    out_html_path = with_ts(RESULT_DIR, in_path.stem, "_stage.html")
    html_text = write_svg_html(
        bgr, regions, out_html_path,
        opacity=opacity, color_summary=color_summary, debug_imgs=None,
        min_render_area=int(min_render_area), ocr_lines=ocr_lines
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
    iou_merge_thr: float = 0.65,
    prefer_top_stage: bool = True,
    stage_cx: Optional[int] = None,
    stage_cy: Optional[int] = None,
    total_attendees: Optional[int] = None,
    quartiles: Tuple[float, float, float] = (0.20, 0.45, 0.75),
    seats_per_component: int = 1,
    neighbor_gap_px: int = 12,
    gray_exclude_ratio: float = 0.55,
    gray_chroma_quantile: float = LAB_GRAY_Q,
    strong_gray_exclude: bool = True,
    use_external_ocr: bool = False,
    ocr_min_score: float = 0.5,
    ocr_mask_dilate: int = 2,
    min_render_area: int = DEFAULT_MIN_RENDER_AREA,
    use_ocr_for_stage: bool = True
):
    bgr = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(str(img_path))
    h, w = bgr.shape[:2]
    if min_area is None:
        min_area = auto_min_area(h, w)

    # 1) FG 추정
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

    # 2) OCR 기반 텍스트 제거(옵션)
    no_text = bgr.copy()
    if use_external_ocr:
        try:
            info = call_ocr_extract_path(str(img_path), min_score=ocr_min_score, mask_dilate=ocr_mask_dilate)
            no_text = inpaint_with_mask(bgr, info.get("text_mask_path"))
        except Exception:
            no_text = bgr.copy()

    # 3) 세그멘테이션
    lists = [
        seg_conncomp(no_text, fg, min_area, color_bgr=bgr),
        seg_slic(no_text, fg, min_area, deltaE_merge=COLOR_DELTA, color_bgr=bgr),
        seg_watershed(no_text, fg, min_area, color_bgr=bgr)
    ] if ensemble else [
        seg_conncomp(no_text, fg, min_area, color_bgr=bgr)
    ]
    regions = merge_ensemble(h, w, lists if ensemble else [lists[0]], iou_merge_thr=iou_merge_thr)

    # 4) Stage center + OCR stage 박스 + fallback + 플래그 부여
    sc = (stage_cx, stage_cy) if (stage_cx is not None and stage_cy is not None) else \
         estimate_stage_center(bgr, prefer_top_stage=prefer_top_stage)

    gray_thr = estimate_gray_thresholds(bgr, q=gray_chroma_quantile)
    mark_gray_black_textish_flags(bgr, regions, gray_thr)

    ocr_lines_norm: List[Dict[str, Any]] = []
    stage_union = None
    if use_ocr_for_stage and httpx is not None:
        lines_raw = call_ocr_extract_bgr(bgr)
        ocr_lines_norm = normalize_ocr_lines(lines_raw)

        stage_bbs = detect_stage_bboxes_from_lines(lines_raw)
        stage_union = union_bbox_xywh(stage_bbs)

        if stage_union is not None:
            sx, sy, sw, sh = stage_union
            margin = int(0.01 * min(h, w))
            sx = max(0, sx - margin); sy = max(0, sy - margin)
            sw = min(w - sx, sw + 2 * margin)
            sh = min(h - sy, sh + 2 * margin)
            stage_union = (sx, sy, sw, sh)

    # OCR 실패 시 소규모 텍스트 중심 박스
    if stage_union is None:
        c = detect_stage_text_center(bgr, prefer_top_stage=prefer_top_stage)
        if c is not None:
            cx, cy = c
            s = int(0.08 * min(h, w))
            x = max(0, cx - s // 2); y = max(0, cy - s // 2)
            stage_union = (x, y, min(s, w - x), min(s, h - y))

    # 완전 실패 시 회색 기반 fallback
    if stage_union is None:
        stage_union = _fallback_stage_from_gray(bgr)

    # 무대/무대계열 처리
    _mark_stage_overlaps_and_noninteractive(regions, stage_union, bgr)

    # 무대 placeholder 생성(실제 겹치는 후보 없을 때만)
    _add_stage_placeholder_if_missing(regions, stage_union, bgr)

    # 디버그 HTML (필터링 전 full snapshot)
    debug_path = with_ts(DEBUG_DIR, f"debug_{img_path.stem}", ".html")
    try:
        write_regions_debug_html(
            debug_path,
            img_bgr=bgr,
            regions=regions,
            stage_center=sc,
            stage_union_xywh=stage_union,
            ocr_lines_norm=ocr_lines_norm
        )
    except Exception:
        pass

    # 렌더 필터: 회색/검정(강배제) + '무대와 실제로 겹치는' 무대색 계열 제거
    ex_ids = set()
    if stage_union is not None:
        sx, sy, sw, sh = stage_union
    for r in regions:
        if r.get("force_render_stage", False):
            continue
        if strong_gray_exclude and r.get("is_gray", False):
            ex_ids.add(r["id"]); continue
        if r.get("is_black", False):
            ex_ids.add(r["id"]); continue
        if r.get("like_stage_color", False) and stage_union is not None:
            frac = _overlap_fraction_poly_rect(h, w, r["polygon"], (sx, sy, sw, sh))
            if frac >= 0.02:
                ex_ids.add(r["id"])

    regions = [r for r in regions if r["id"] not in ex_ids]

    # 보증: 무대 폴리곤이 하나도 안 남으면 placeholder 재보장
    has_stage_poly = any(r.get("force_render_stage") or str(r.get("id","")).startswith("poly_STAGE") for r in regions)
    if (not has_stage_poly) and (stage_union is not None):
        _add_stage_placeholder_if_missing(regions, stage_union, bgr)

    # 5) 레벨/수용 인원
    assign_levels_and_capacity(
        regions, sc, total_attendees, quartiles, seats_per_component,
        color_delta=COLOR_DELTA, exclude_gray_ids=set(),
        neighbor_gap_px=int(neighbor_gap_px)
    )
    color_summary = _color_group_summary([r for r in regions if r.get("seat_level")])

    # 6) 저장 (HTML + META)
    out_html_path = with_ts(RESULT_DIR, img_path.stem, "_v4.html")
    html_text = write_svg_html(
        bgr, regions, out_html_path,
        color_summary=color_summary, min_render_area=int(min_render_area),
        ocr_lines=ocr_lines_norm
    )

    meta = {
        "source": img_path.name,
        "version": "v4.8-stageOverlap0001-topTie-guardAfterFilter",
        "width": int(w), "height": int(h),
        "stage": {"cx": int(sc[0]), "cy": int(sc[1])},
        "ensemble": bool(ensemble),
        "min_area": int(min_area),
        "color_delta": COLOR_DELTA,
        "gray_thresholds": gray_thr,
        "removed_by_stage_like": sorted(list(ex_ids)),
        "color_groups": color_summary,
        "regions": regions,
        "ocr": {
            "lines": ocr_lines_norm,
            "stage_union": stage_union
        }
    }
    json_path = with_ts(META_DIR, img_path.stem, "_v4.json")
    json_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    # debug saves
    cv2.imwrite(str(with_ts(RESULT_DIR, img_path.stem, "_v4_fg0.png")), fg0)
    cv2.imwrite(str(with_ts(RESULT_DIR, img_path.stem, "_v4_fg.png")), fg)
    lab_full = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    gmask_full = is_gray_lab(lab_full, gray_thr["chroma_thr"], gray_thr["L_low"], gray_thr["L_high"]).astype(np.uint8) * 255
    cv2.imwrite(str(with_ts(RESULT_DIR, img_path.stem, "_v4_graymask.png")), gmask_full)

    return str(out_html_path), str(json_path), html_text

# ----------------------------
# Pipeline endpoints (once)
# ----------------------------
@pipe_router.get("/health")
def health():
    return {"ok": True}

@pipe_router.post("/process")
async def pipeline_process(file: UploadFile = File(...)):
    in_path = DATA_DIR / file.filename
    with open(in_path, "wb") as f:
        f.write(await file.read())

    d = PIPELINE_DEFAULTS
    html_path, json_path, _ = _process_image_pipeline(
        in_path,
        crop_legend=d["crop_legend"],
        ensemble=d["ensemble"],
        min_area=d["min_area"],
        iou_merge_thr=d["iou_merge_thr"],
        prefer_top_stage=d["prefer_top_stage"],
        stage_cx=d["stage_cx"],
        stage_cy=d["stage_cy"],
        total_attendees=d["total_attendees"],
        quartiles=d["quartiles"],
        seats_per_component=d["seats_per_component"],
        neighbor_gap_px=d["neighbor_gap_px"],
        gray_exclude_ratio=d["gray_exclude_ratio"],
        gray_chroma_quantile=d["gray_chroma_quantile"],
        strong_gray_exclude=d["strong_gray_exclude"],
        use_external_ocr=d["use_external_ocr"],
        ocr_min_score=d["ocr_min_score"],
        ocr_mask_dilate=d["ocr_mask_dilate"],
        min_render_area=d["min_render_area"],
        use_ocr_for_stage=d["use_ocr_for_stage"],
    )
    return {"ok": True, "input": str(in_path), "html": html_path, "json": json_path,
            "debug": str(DEBUG_DIR / f"debug_{in_path.stem}.html")}

@pipe_router.post("/process_html")
async def pipeline_process_html(file: UploadFile = File(...)):
    in_path = DATA_DIR / file.filename
    with open(in_path, "wb") as f:
        f.write(await file.read())

    d = PIPELINE_DEFAULTS
    _, _, html_text = _process_image_pipeline(
        in_path,
        crop_legend=d["crop_legend"],
        ensemble=d["ensemble"],
        min_area=d["min_area"],
        iou_merge_thr=d["iou_merge_thr"],
        prefer_top_stage=d["prefer_top_stage"],
        stage_cx=d["stage_cx"],
        stage_cy=d["stage_cy"],
        total_attendees=d["total_attendees"],
        quartiles=d["quartiles"],
        seats_per_component=d["seats_per_component"],
        neighbor_gap_px=d["neighbor_gap_px"],
        gray_exclude_ratio=d["gray_exclude_ratio"],
        gray_chroma_quantile=d["gray_chroma_quantile"],
        strong_gray_exclude=d["strong_gray_exclude"],
        use_external_ocr=d["use_external_ocr"],
        ocr_min_score=d["ocr_min_score"],
        ocr_mask_dilate=d["ocr_mask_dilate"],
        min_render_area=d["min_render_area"],
        use_ocr_for_stage=d["use_ocr_for_stage"],
    )
    return Response(content=html_text, media_type="text/html; charset=utf-8")

@pipe_router.post("/batch")
def pipeline_batch(pattern: str = Query("image*.png")):
    paths = sorted(DATA_DIR.glob(pattern))
    outs = []
    d = PIPELINE_DEFAULTS
    for p in paths:
        try:
            html_path, json_path, _ = _process_image_pipeline(
                p,
                crop_legend=d["crop_legend"],
                ensemble=d["ensemble"],
                min_area=d["min_area"],
                iou_merge_thr=d["iou_merge_thr"],
                prefer_top_stage=d["prefer_top_stage"],
                stage_cx=d["stage_cx"],
                stage_cy=d["stage_cy"],
                total_attendees=d["total_attendees"],
                quartiles=d["quartiles"],
                seats_per_component=d["seats_per_component"],
                neighbor_gap_px=d["neighbor_gap_px"],
                gray_exclude_ratio=d["gray_exclude_ratio"],
                gray_chroma_quantile=d["gray_chroma_quantile"],
                strong_gray_exclude=d["strong_gray_exclude"],
                use_external_ocr=d["use_external_ocr"],
                ocr_min_score=d["ocr_min_score"],        # ✅ 오타 수정
                ocr_mask_dilate=d["ocr_mask_dilate"],
                min_render_area=d["min_render_area"],
                use_ocr_for_stage=d["use_ocr_for_stage"],
            )
            outs.append({"file": p.name, "html": html_path, "json": json_path,
                         "debug": str(DEBUG_DIR / f"debug_{p.stem}.html")})
        except Exception as e:
            outs.append({"file": p.name, "error": str(e)})
    return {"ok": True, "count": len(outs), "results": outs}

# ----------------------------
# Root & include routers
# ----------------------------
@app.get("/")
def root():
    return {
        "app": "STH_v1 Modular FastAPI (B-plan + OCR overlay + stage-fallback)",
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
#   uvicorn main_modular:app --host 0.0.0.0 --port 8000
# Swagger:
#   http://localhost:8000/docs
