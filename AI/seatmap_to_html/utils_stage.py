# utils_stage.py
# Consolidated utilities for seatmap processing & stage detection.
from __future__ import annotations
from typing import List, Tuple, Optional, Dict, Any
import cv2, numpy as np, math, os

# ==== DEBUG SWITCHES ====
DEBUG_REGION_SNAPSHOTS = False
DEBUG_OUTDIR = "/mnt/data"

# ==== LAB gray thresholds (안전 기본값) ====
LAB_GRAY_Q  = 0.10   # 채도 분포의 하위 10% + margin 을 ‘무채색’ 기준으로
LAB_L_LOW   = 12.0   # 너무 어두운(검정에 가까운) 영역 제외 하한
LAB_L_HIGH  = 245.0  # 너무 밝은(배경 흰색/종이) 영역 제외 상한

# -------------------------------------------------
# Debug helpers
# -------------------------------------------------
def _dbg_tag(reg: dict, keep: bool, reason: str = ""):
    reg["_keep"] = bool(keep)
    reg["_reason"] = reason or ""
    return reg

def _dbg_dump(img_bgr, regs, name: str, outdir: str = DEBUG_OUTDIR):
    try:
        os.makedirs(outdir, exist_ok=True)
        # img_bgr 가 None 일 수도 있으므로 안전 캔버스
        if img_bgr is None:
            img_bgr = np.zeros((640, 640, 3), np.uint8)
        dbg = img_bgr.copy()
        for r in regs or []:
            poly = np.array(r.get("polygon") or r.get("poly"), np.int32).reshape(-1,1,2)
            keep = r.get("_keep", True)
            color = (40,180,60) if keep else (40,40,220)
            cv2.polylines(dbg, [poly], True, color, 2, cv2.LINE_AA)
            if not keep:
                x,y,w,h = r.get("xywh") or r.get("bbox") or (0,0,0,0)
                cv2.putText(dbg, r.get("_reason",""), (int(x), max(12,int(y)-4)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1, cv2.LINE_AA)
        cv2.imwrite(os.path.join(outdir, f"debug_after_{name}.png"), dbg)
    except Exception:
        pass

# -------------------------------------------------
# Gray mask (lighting compensated)
# -------------------------------------------------
def build_gray_mask(bgr: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L = lab[:,:,0]
    bg = cv2.medianBlur(L, 21)
    norm = cv2.subtract(L, bg)
    norm = cv2.normalize(norm, None, 0, 255, cv2.NORM_MINMAX)
    thr = cv2.adaptiveThreshold(norm, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                cv2.THRESH_BINARY, 31, -3)
    low = (L < 18).astype(np.uint8) * 255
    high = (L > 245).astype(np.uint8) * 255
    thr[low==255] = 0
    thr[high==255] = 0
    thr = cv2.morphologyEx(thr, cv2.MORPH_OPEN,
                           cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)), 1)
    thr = cv2.morphologyEx(thr, cv2.MORPH_CLOSE,
                           cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)), 2)
    h, w = thr.shape
    m = np.zeros_like(thr)
    cv2.rectangle(m, (int(0.01*w), int(0.01*h)), (int(0.99*w), int(0.99*h)), 255, -1)
    thr = cv2.bitwise_and(thr, m)
    return thr

def strip_text_regions(bgr: np.ndarray, mask: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 60, 140)
    edges = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT,(3,3)), 1)
    inv = cv2.bitwise_not(edges)
    dist = cv2.distanceTransform(inv, cv2.DIST_L2, 3)
    thin = (dist < 1.8).astype(np.uint8) * 255
    hor = cv2.morphologyEx(edges, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT,(25,1)), 1)
    ver = cv2.morphologyEx(edges, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT,(1,25)), 1)
    line_like = cv2.bitwise_or(hor, ver)
    kill = cv2.bitwise_or(thin, line_like)
    cleaned = mask.copy()
    cleaned[kill==255] = 0
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN,
                               cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)), 1)
    return cleaned

def find_stage_polygon(bin_mask: np.ndarray):
    cnts, _ = cv2.findContours(bin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = (None, -1.0)
    h, w = bin_mask.shape
    for c in cnts:
        area = cv2.contourArea(c)
        if area < 0.002 * w * h:
            continue
        (cx, cy), (rw, rh), ang = cv2.minAreaRect(c)
        long_side, short_side = (rw, rh) if rw >= rh else (rh, rw)
        aspect = (long_side + 1e-6) / (short_side + 1e-6)
        approx = cv2.approxPolyDP(c, 0.01 * cv2.arcLength(c, True), True)
        thin_long = min(rw, rh) / (max(rw, rh) + 1e-6)
        thin_score = 1.0 - thin_long
        width_score = (max(rw, rh) / w)
        top_bias = max(0.0, 1.0 - cy / h)
        score = 0.55*width_score + 0.35*thin_score + 0.10*top_bias
        if aspect > 2.2 and score > best[1]:
            best = (approx.reshape(-1,2).astype(np.int32), float(score))
    return best

# -------------------------------------------------
# Text mask (MSER) & inpaint
# -------------------------------------------------
def text_mask_mser(bgr: np.ndarray, fg_mask: Optional[np.ndarray] = None) -> np.ndarray:
    """
    MSER로 텍스트 후보를 잡고, 에지로 보강한 텍스트 마스크.
    (OpenCV 파이썬 바인딩: MSER_create 키워드 인자 미지원 → setter 사용)
    """
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    mser = cv2.MSER_create()
    mser.setDelta(5)
    mser.setMinArea(30)
    mser.setMaxArea(8000)

    regions, _ = mser.detectRegions(gray)
    mask = np.zeros_like(gray, np.uint8)
    for pts in regions:
        x, y, w, h = cv2.boundingRect(pts)
        ar = w / max(h, 1)
        if 0.2 < ar < 12 and 6 <= min(w, h) <= 150:
            cv2.rectangle(mask, (x, y), (x + w, y + h), 255, -1)

    if fg_mask is not None:
        m = fg_mask.astype(np.uint8)
        if m.max() == 1:
            m = m * 255
        mask = cv2.bitwise_and(mask, m)

    edges = cv2.Canny(gray, 60, 140)
    edges = cv2.dilate(edges, np.ones((2, 2), np.uint8), 1)
    edges = cv2.bitwise_and(edges, mask)
    mask = np.maximum(mask, edges)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,
                            cv2.getStructuringElement(cv2.MORPH_RECT, (1, 3)), 1)
    return mask

def inpaint_soft(bgr: np.ndarray, text_mask: np.ndarray) -> np.ndarray:
    mask = (text_mask > 0).astype(np.uint8) * 255
    if mask.sum() == 0:
        return bgr.copy()
    num, cc = cv2.connectedComponents(mask)
    out = bgr.copy()
    for lab in range(1, num):
        comp = (cc == lab).astype(np.uint8)
        area = int(comp.sum())
        if area < 400:
            dil = cv2.dilate(comp, cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)), 1)
            for c in range(3):
                ch = out[...,c]
                med = cv2.medianBlur(ch, 9)
                ch[comp>0] = med[comp>0]
                out[...,c] = ch
        else:
            out = cv2.inpaint(out, comp*255, 3, cv2.INPAINT_TELEA)
    return out

# -------------------------------------------------
# Segmentation wrapper (robust)
# -------------------------------------------------
def _dilate_variants(mask: np.ndarray, H: int, W: int) -> list[np.ndarray]:
    k = max(2, int(round(0.006 * max(H, W))))
    k1 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    k2 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k*2, k*2))
    k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k*3, k*3))
    return [cv2.dilate(mask, k1, 1), cv2.dilate(mask, k2, 1), cv2.dilate(mask, k3, 1)]

def _build_no_text_variants(bgr: np.ndarray, fg_mask: np.ndarray) -> list[np.ndarray]:
    H, W = bgr.shape[:2]
    tmask_base = text_mask_mser(bgr, fg_mask)
    variants = _dilate_variants(tmask_base, H, W)
    return [inpaint_soft(bgr, vm) for vm in variants]

def _score_regions(h: int, w: int, regs: list[dict]) -> float:
    areas = [float(r.get("area", 0.0)) for r in regs]
    if not areas: return 0.0
    coverage = sum(areas) / float(h*w)
    n = len(areas)
    mean_area = sum(areas)/n
    score = 0.0
    if 0.10 <= coverage <= 0.65: score += 1.0
    score += min(1.0, n/80.0)
    if 1500.0 <= mean_area <= 150000.0: score += 0.8
    return score

def segment_with_text_robust(
    bgr: np.ndarray,
    *,
    fg_mask: np.ndarray,
    min_area: int,
    iou_merge_thr: float,
    seg_conncomp, seg_slic, seg_watershed, merge_ensemble,
    COLOR_DELTA: float,
    fast: bool = False   # ✅ 추가
) -> list[dict]:
    h, w = bgr.shape[:2]

    if fast:
        # 단일 패스: conncomp + slic → ensemble
        Ls = [
            seg_conncomp(bgr, fg_mask, min_area, color_bgr=bgr),
            seg_slic(bgr, fg_mask, min_area, deltaE_merge=COLOR_DELTA, color_bgr=bgr),
        ]
        regs = merge_ensemble(h, w, Ls, iou_merge_thr=iou_merge_thr)
        return regs

    # === 기존 느린 경로 (변형 3종 + 워터셰드 포함) ===
    no_text_variants = _build_no_text_variants(bgr, fg_mask)
    candidates = []
    for no_text in no_text_variants:
        Ls = [
            seg_conncomp(no_text, fg_mask, min_area, color_bgr=bgr),
            seg_slic(no_text, fg_mask, min_area, deltaE_merge=COLOR_DELTA, color_bgr=bgr),
            seg_watershed(no_text, fg_mask, min_area, color_bgr=bgr),
        ]
        regs = merge_ensemble(h, w, Ls, iou_merge_thr=iou_merge_thr)
        candidates.append((_score_regions(h, w, regs), regs))
    if not candidates or max(candidates, key=lambda x: x[0])[0] < 0.5:
        Ls0 = [
            seg_conncomp(bgr, fg_mask, min_area, color_bgr=bgr),
            seg_slic(bgr, fg_mask, min_area, deltaE_merge=COLOR_DELTA, color_bgr=bgr),
            seg_watershed(bgr, fg_mask, min_area, color_bgr=bgr),
        ]
        regs0 = merge_ensemble(h, w, Ls0, iou_merge_thr=iou_merge_thr)
        candidates.append((_score_regions(h, w, regs0), regs0))
    return max(candidates, key=lambda x: x[0])[1]

def auto_min_area(h: int, w: int) -> int:
    px = h * w
    lower = int(px * 0.00015)
    upper = int(px * 0.06)
    base = int(px * 0.00025)
    return max(lower, min(base, upper))

# -------------------------------------------------
# Region shape/color helpers & suppressors
# -------------------------------------------------
def is_ribbon_like(r: dict, img_w: int, img_h: int) -> bool:
    x, y, w, h = r.get("bbox", (0,0,0,0))
    long_side = max(w, h); short_side = min(w, h)
    if short_side <= 0: return False
    aspect = (long_side + 1e-6) / (short_side + 1e-6)
    area = float(r.get("area", 0.0))
    px = float(img_w * img_h)
    cond_aspect   = aspect >= 6.0
    cond_thick    = 6 <= short_side <= 34
    cond_length   = long_side >= 0.16 * img_w
    cond_area_min = area >= px * 0.00018
    return bool(cond_aspect and cond_thick and cond_length and cond_area_min)

def _poly_area(poly: np.ndarray) -> float:
    return float(abs(cv2.contourArea(poly.reshape(-1,1,2))))

def _centroid(poly: np.ndarray) -> Tuple[float,float]:
    M = cv2.moments(poly.reshape(-1,1,2))
    if M["m00"] == 0: return (float(poly[:,0].mean()), float(poly[:,1].mean()))
    return (M["m10"]/M["m00"], M["m01"]/M["m00"])

def _mean_bgr_under_poly(img_bgr: np.ndarray, poly: np.ndarray) -> Tuple[float,float,float]:
    mask = np.zeros(img_bgr.shape[:2], np.uint8)
    cv2.fillPoly(mask, [poly.reshape(-1,1,2)], 255)
    pts = img_bgr[mask==255].reshape(-1,3)
    if pts.size == 0: return (0.0,0.0,0.0)
    m = pts.mean(axis=0)
    return (float(m[0]), float(m[1]), float(m[2]))

def _deltaE_bgr(b1,b2) -> float:
    return float(np.linalg.norm(np.array(b1)-np.array(b2)))

def suppress_inner_islands(regs: list[dict], img_bgr: np.ndarray,
                           area_ratio_thr: float = 0.06,
                           deltaE_thr: float = 10.0) -> list[dict]:
    if not regs: return regs
    polys = [np.array(r.get("polygon") or r.get("poly"), np.int32) for r in regs]
    areas = [_poly_area(p) for p in polys]
    means = [_mean_bgr_under_poly(img_bgr, p) for p in polys]
    keep = [True]*len(regs)
    for i, (pi, ai) in enumerate(zip(polys, areas)):
        if ai <= 0 or regs[i].get("force_render_stage"): 
            continue
        ci = _centroid(pi)
        for j, (pj, aj) in enumerate(zip(polys, areas)):
            if i == j: continue
            inside = cv2.pointPolygonTest(pj.reshape(-1,1,2), ci, False) >= 0
            if not inside or aj <= ai: 
                continue
            if (ai/aj) < area_ratio_thr:
                if _deltaE_bgr(means[i], means[j]) < deltaE_thr:
                    keep[i] = False
                    regs[i]["_keep"] = False
                    regs[i]["_reason"] = "inner_island"
                    break
    out = [r for k, r in zip(keep, regs) if k]
    if DEBUG_REGION_SNAPSHOTS:
        _dbg_dump(img_bgr, regs, "suppress_inner_islands", outdir=DEBUG_OUTDIR)
    return out

def suppress_nested_samegroup(regs: list[dict],
                              area_ratio_thr: float = 0.15,
                              use_color_group: bool = True) -> list[dict]:
    if not regs: return regs
    polys, areas, groups, fills = [], [], [], []
    for r in regs:
        p = np.array(r.get("polygon") or r.get("poly"), np.int32).reshape(-1, 2)
        polys.append(p)
        areas.append(float(r.get("area", abs(cv2.contourArea(p.reshape(-1,1,2))))))
        groups.append(int(r.get("color_group", -1)))
        fills.append(str(r.get("fill", "")))

    def _same_bucket(i, j) -> bool:
        if use_color_group:
            return groups[i] >= 0 and groups[i] == groups[j]
        return fills[i] == fills[j]

    keep = [True] * len(regs)
    for i, pi in enumerate(polys):
        ai = areas[i]
        if ai <= 0: 
            continue
        ci = (float(pi[:,0].mean()), float(pi[:,1].mean()))
        for j, pj in enumerate(polys):
            if i == j: 
                continue
            aj = areas[j]
            if aj <= ai:
                continue
            inside = cv2.pointPolygonTest(pj.reshape(-1,1,2), ci, False) >= 0
            if not inside:
                continue
            if not _same_bucket(i, j):
                continue
            if (ai / aj) < area_ratio_thr:
                keep[i] = False
                regs[i]["_keep"] = False
                regs[i]["_reason"] = "nested_samegroup"
                break
    out = [r for k, r in zip(keep, regs) if k]
    if DEBUG_REGION_SNAPSHOTS:
        _dbg_dump(np.zeros((10,10,3),np.uint8), regs, "suppress_nested_samegroup", outdir=DEBUG_OUTDIR)
    return out

def suppress_subpolys_samegroup_mask(
    regs: list[dict],
    img_h: int, img_w: int,
    area_ratio_thr: float = 0.28,
    outside_frac_thr: float = 0.12,
    use_color_group: bool = True,
    de_fallback_thr: float = 12.0
) -> list[dict]:
    if not regs: return regs
    polys = [np.array(r.get("polygon") or r.get("poly"), np.int32).reshape(-1,2) for r in regs]
    areas, groups, fills, means = [], [], [], []

    def _mean_bgr_under_poly_local(img_bgr: np.ndarray, poly: np.ndarray) -> tuple[float,float,float]:
        mask = np.zeros((img_h, img_w), np.uint8)
        cv2.fillPoly(mask, [poly.reshape(-1,1,2)], 255)
        pts = img_bgr[mask==255].reshape(-1,3)
        if pts.size == 0: return (0.0,0.0,0.0)
        m = pts.mean(axis=0)
        return (float(m[0]), float(m[1]), float(m[2]))

    for r, p in zip(regs, polys):
        a = abs(cv2.contourArea(p.reshape(-1,1,2)))
        areas.append(float(a))
        groups.append(int(r.get("color_group", -1)))
        fills.append(str(r.get("fill", "")))
        img_bgr = r.get("_img_bgr", None)
        if img_bgr is None:
            img_bgr = np.zeros((img_h,img_w,3),np.uint8)
        means.append(_mean_bgr_under_poly_local(img_bgr, p))

    k = max(1, min(4, int(round(0.004 * max(img_h, img_w)))))
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2*k+1, 2*k+1))

    def _deltaE_bgr_local(b1,b2) -> float:
        return float(np.linalg.norm(np.array(b1)-np.array(b2)))

    def _same_bucket(i, j) -> bool:
        if use_color_group and groups[i] >= 0 and groups[j] >= 0:
            if groups[i] == groups[j]:
                return True
        return _deltaE_bgr_local(means[i], means[j]) < de_fallback_thr

    keep = [True]*len(regs)
    for i, (pi, ai) in enumerate(zip(polys, areas)):
        if ai <= 0 or regs[i].get("force_render_stage"):
            continue
        mask_i = np.zeros((img_h, img_w), np.uint8)
        cv2.fillPoly(mask_i, [pi.reshape(-1,1,2)], 255)
        child_area_px = int((mask_i > 0).sum())

        for j, (pj, aj) in enumerate(zip(polys, areas)):
            if i == j or aj <= ai:
                continue
            if not _same_bucket(i, j):
                continue

            mask_j = np.zeros((img_h, img_w), np.uint8)
            cv2.fillPoly(mask_j, [pj.reshape(-1,1,2)], 255)
            if k > 0:
                mask_j = cv2.dilate(mask_j, ker, 1)

            diff = cv2.subtract(mask_i, mask_j)
            outside_frac = float((diff > 0).sum()) / max(1.0, float(child_area_px))
            area_ratio = ai / aj if aj > 0 else 1.0

            if (area_ratio < area_ratio_thr) and (outside_frac <= outside_frac_thr):
                keep[i] = False
                regs[i]["_keep"] = False
                regs[i]["_reason"] = "subpoly_samegroup_mask"
                break

    out = [r for kf, r in zip(keep, regs) if kf]
    if DEBUG_REGION_SNAPSHOTS:
        _dbg_dump(np.zeros((max(10,img_h), max(10,img_w), 3), np.uint8),
                  regs, "suppress_subpolys_samegroup_mask", outdir=DEBUG_OUTDIR)
    return out

# -------------------------------------------------
# Stage heuristics + gray threshold helpers
# -------------------------------------------------
def _poly_to_xywh(poly: List[List[int]]) -> Tuple[int,int,int,int]:
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    return int(x0), int(y0), int(max(1, x1 - x0)), int(max(1, y1 - y0))

def _is_grayish_lab(lab_vec: List[float], chroma_thr: float, L_low: float, L_high: float) -> bool:
    L, a, b = float(lab_vec[0]), float(lab_vec[1]), float(lab_vec[2])
    chroma = math.hypot(a - 128.0, b - 128.0)
    return (chroma <= chroma_thr) and (L >= L_low) and (L <= L_high)

def estimate_gray_thresholds(img_bgr: np.ndarray, q: float = LAB_GRAY_Q) -> Dict[str, float]:
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    a = np.abs(lab[:, :, 1] - 128.0)
    b = np.abs(lab[:, :, 2] - 128.0)
    chroma = np.sqrt(a * a + b * b)
    chroma_thr = float(np.quantile(chroma.reshape(-1), q)) + 3.0
    return {"chroma_thr": chroma_thr, "L_low": LAB_L_LOW, "L_high": LAB_L_HIGH}

def find_stage_by_heuristics(
    regions: List[Dict],
    img_h: int,
    img_w: int,
    *,
    bgr: np.ndarray | None = None,
    edge_ratio: float = 0.17,            # 상/하단 17% 밴드
    center_ratio: float = 0.30,          # ★ 중앙 30% 밴드 허용 (세로형 STAGE 대응)
    min_area_frac: float = 0.002,        # 0.004 → 0.002 (완화)
    min_elongation: float = 1.6,         # ★ 가로/세로 무관한 길쭉함 기준
    use_region_flags_first: bool = True,
    allow_non_gray_fallback: bool = True,
    non_gray_area_frac_thr: float = 0.010,
    non_gray_elong_thr: float = 1.8      # 비회색 fallback의 길쭉함 기준
) -> Optional[Tuple[int,int,int,int]]:
    if not regions:
        return None

    H, W = int(img_h), int(img_w)
    top_cut     = int(H * edge_ratio)
    bottom_cut  = int(H * (1.0 - edge_ratio))
    center_low  = int(H * ((1.0 - center_ratio) * 0.5))
    center_high = int(H * (1.0 - (1.0 - center_ratio) * 0.5))
    area_min    = H * W * min_area_frac

    # LAB 임계 (안전 기본값 포함)
    try:
        thr = estimate_gray_thresholds(bgr if bgr is not None else np.zeros((H,W,3), np.uint8))
        chroma_thr = thr["chroma_thr"]; L_low = thr["L_low"]; L_high = thr["L_high"]
    except Exception:
        chroma_thr, L_low, L_high = 12.0, 10.0, 252.0

    def _grayish_by_region_or_mean(r, poly):
        # 1) 플래그 우선
        if use_region_flags_first and (r.get("is_gray") or r.get("is_black")):
            return True
        # 2) region의 LAB 값
        lab_med = r.get("lab_med") or r.get("lab_for_group")
        if lab_med is not None:
            return _is_grayish_lab(lab_med, chroma_thr, L_low, L_high)
        # 3) 평균색으로 재판정
        if bgr is not None and poly is not None:
            mean_b, mean_g, mean_r = _mean_bgr_under_poly(bgr, poly)
            lab_vec = cv2.cvtColor(
                np.uint8([[[mean_b, mean_g, mean_r]]]),
                cv2.COLOR_BGR2LAB
            )[0,0,:].astype(float).tolist()
            return _is_grayish_lab(lab_vec, chroma_thr, L_low, L_high)
        return False

    best = None
    best_score = -1.0

    for r in regions:
        poly = r.get("polygon") or r.get("points") or []
        if not poly:
            continue
        x, y, w, h = (r.get("bbox") if r.get("bbox") else _poly_to_xywh(poly))
        if w <= 0 or h <= 0:
            continue

        cy = y + h * 0.5
        at_edge   = (cy <= top_cut) or (cy >= bottom_cut)
        at_center = (center_low <= cy <= center_high)  # ★ 중앙도 허용

        if not (at_edge or at_center):
            continue

        # 방향 무관 elongation (가로든 세로든 길쭉하면 OK)
        short_side = max(1, min(w, h))
        elongation = max(w, h) / short_side

        grayish = _grayish_by_region_or_mean(r, np.array(poly, np.int32).reshape(-1,2) if poly else None)
        area = w * h

        passed_normal = grayish and (area >= area_min) and (elongation >= min_elongation)

        passed_fallback = False
        if (not passed_normal) and allow_non_gray_fallback:
            big_enough  = (area >= (H * W * non_gray_area_frac_thr))
            long_enough = (elongation >= non_gray_elong_thr)
            if big_enough and long_enough:
                passed_fallback = True

        if not (passed_normal or passed_fallback):
            continue

        # 점수: 면적 중심 + 위치 보정(상단 소폭 + 중앙도 소폭)
        pos_bonus = 0.10 if (cy <= top_cut) else (0.06 if at_center else 0.0)
        score = area * (1.0 + pos_bonus)

        if score > best_score:
            best_score = score
            best = (int(x), int(y), int(w), int(h))

    return best

# -------------------------------------------------
# Final stage detector + overlap marker (NEW)
# -------------------------------------------------
def _bbox_to_poly(x, y, w, h):
    return np.array([[x,y],[x+w,y],[x+w,y+h],[x,y+h]], np.int32)

def _score_stage_candidate(H, W, *, poly=None, xywh=None, top_bias=True):
    if poly is not None:
        x,y,w,h = cv2.boundingRect(poly.reshape(-1,1,2))
    else:
        x,y,w,h = xywh
    if w<=0 or h<=0:
        return -1.0
    area = (w*h)/(H*W + 1e-6)
    aspect = w/max(1,h)
    cy = y + h*0.5
    top_bonus = 0.06 if (top_bias and cy < H*0.35) else 0.0
    return (min(1.0, area/0.08) * 0.55) + (min(1.0, aspect/3.0) * 0.35) + top_bonus

def detect_stage_final(bgr: np.ndarray, regions: List[Dict[str,Any]]) -> Dict[str, Any]:
    H,W = bgr.shape[:2]
    best = {"poly": None, "xywh": None, "source": "none", "score": -1.0}

    # (1) region 기반 휴리스틱
    try:
        xywh_h = find_stage_by_heuristics(regions, H, W, bgr=bgr)
        if xywh_h:
            sc = _score_stage_candidate(H,W, xywh=xywh_h, top_bias=True)
            if sc > best["score"]:
                best = {"poly": None, "xywh": xywh_h, "source": "heuristic", "score": sc}
    except Exception:
        pass

    # (2) 회색마스크 → 텍스트 제거 → 폴리곤
    try:
        gray = build_gray_mask(bgr)
        gray_wo_text = strip_text_regions(bgr, gray)
        poly_m, score_hint = find_stage_polygon(gray_wo_text)
        if poly_m is not None:
            sc = _score_stage_candidate(H,W, poly=poly_m, top_bias=True) + 0.05
            if sc > best["score"]:
                best = {"poly": poly_m, "xywh": cv2.boundingRect(poly_m.reshape(-1,1,2)), "source": "mask", "score": sc}
    except Exception:
        pass

    # 보정
    if best["xywh"] is None and best["poly"] is not None:
        best["xywh"] = cv2.boundingRect(best["poly"].reshape(-1,1,2))
    if best["poly"] is None and best["xywh"] is not None:
        x,y,w,h = best["xywh"]
        best["poly"] = _bbox_to_poly(x,y,w,h)

    # 최소 요건
    if best["xywh"] is not None:
        x,y,w,h = best["xywh"]
        if (w/max(1,h)) < 1.4 or (w*h) < (H*W*0.003):
            best = {"poly": None, "xywh": None, "source": "none", "score": -1.0}

    # 패딩(안정화)
    if best["xywh"] is not None:
        x,y,w,h = best["xywh"]
        pad = int(0.01 * max(H,W))
        x = max(0, x - pad); y = max(0, y - pad)
        w = min(W - x, w + 2*pad); h = min(H - y, h + 2*pad)
        best["xywh"] = (x,y,w,h)
        best["poly"] = _bbox_to_poly(x,y,w,h)

    return best

def mark_noninteractive_stage(regions: List[Dict[str,Any]],
                              stage_xywh: Optional[Tuple[int,int,int,int]],
                              bgr: np.ndarray,
                              *,
                              iou_thr_bbox: float = 0.025,
                              area_overlap_thr: float = 0.02,
                              like_stage_deltaE: float = 10.0) -> None:
    if not regions or not stage_xywh:
        return
    H,W = bgr.shape[:2]
    sx,sy,sw,sh = stage_xywh
    stage_poly = np.array([[sx,sy],[sx+sw,sy],[sx+sw,sy+sh],[sx,sy+sh]], np.int32)
    stage_mean = _mean_bgr_under_poly(bgr, stage_poly)

    stage_mask = np.zeros((H,W), np.uint8)
    cv2.fillPoly(stage_mask, [stage_poly.reshape(-1,1,2)], 255)

    for r in regions:
        p = np.array(r.get("polygon") or r.get("poly"), np.int32).reshape(-1,2)
        if p.size == 0:
            continue
        rm = np.zeros((H,W), np.uint8)
        cv2.fillPoly(rm, [p.reshape(-1,1,2)], 255)
        inter = cv2.bitwise_and(stage_mask, rm)
        overlap_frac = float((inter>0).sum())/max(1.0, float((rm>0).sum()))

        mean_r = _mean_bgr_under_poly(bgr, p)
        like_stage = (_deltaE_bgr(mean_r, stage_mean) <= like_stage_deltaE)

        x,y,w,h = r.get("bbox", cv2.boundingRect(p.reshape(-1,1,2)))
        xi = max(sx, x); yi = max(sy, y)
        xa = min(sx+sw, x+w); ya = min(sy+sh, y+h)
        inter_bbox = max(0, xa-xi) * max(0, ya-yi)
        iou_bbox = inter_bbox / float(sw*sh + w*h - inter_bbox + 1e-6)

        cond_overlap = (overlap_frac >= area_overlap_thr) or like_stage or (iou_bbox >= iou_thr_bbox)

        if cond_overlap and not is_ribbon_like(r, W, H):
            r["non_interactive_stage"] = True
            _dbg_tag(r, False, "overlap_stage")
        else:
            r["non_interactive_stage"] = False
