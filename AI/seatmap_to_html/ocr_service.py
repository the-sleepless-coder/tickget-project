# ocr_service.py
# PaddleOCR 전용 마이크로서비스
# Run: uvicorn ocr_service:app --host 0.0.0.0 --port 8100
# Swagger: http://localhost:8100/docs

from __future__ import annotations
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import os

# Paddle / PaddleOCR 잡다한 로그 축소
os.environ["GLOG_minloglevel"] = "3"   # 0~3 (INFO→ERROR만)
os.environ["FLAGS_minloglevel"] = "2"  # Paddle C++ 로그 축소

import base64
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

# pip install paddlepaddle==3.2.0 paddleocr==3.2.0 paddlex==3.2.1
from paddleocr import PaddleOCR  # type: ignore

DATA_DIR = Path("./ocr_data")
OUT_DIR = DATA_DIR / "out"
for d in (DATA_DIR, OUT_DIR):
    d.mkdir(parents=True, exist_ok=True)

lang = os.environ.get("OCR_LANG", "en")  # 필요시 "korean"
ocr = PaddleOCR(lang=lang, use_angle_cls=True)  # 모델 로드(수 초)

app = FastAPI(title="Tick-get OCR Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True, "service": "ocr", "lang": lang}

# (파일 상단 유틸들 아래 아무데나 추가)
def _parse_paddle_result(res, min_score: float):
    """
    PaddleOCR 결과를 버전 차이에 안전하게 파싱.
    반환형: items = [{"text","score","poly","bbox","center"}...]
    """
    def _poly_to_bbox_and_center(poly):
        xs = [float(p[0]) for p in poly]
        ys = [float(p[1]) for p in poly]
        x1, x2 = int(min(xs)), int(max(xs))
        y1, y2 = int(min(ys)), int(max(ys))
        cx = float(sum(xs) / max(1, len(xs)))
        cy = float(sum(ys) / max(1, len(ys)))
        return [x1, y1, x2, y2], [cx, cy]

    items = []
    if res is None:
        return items

    pages = res if isinstance(res, list) else [res]
    for page in pages:
        if page is None:
            continue
        # page는 보통 "라인들의 리스트"
        for elem in page:
            poly, txt, score = None, "", 0.0

            # dict 형태 (일부 파이프라인/래퍼)
            if isinstance(elem, dict):
                txt   = str(elem.get("text", ""))
                score = float(elem.get("score", 0.0) or 0.0)
                poly  = elem.get("poly") or elem.get("points") or elem.get("box")
                if isinstance(poly, dict) and "points" in poly:
                    poly = poly["points"]

            # tuple/list 형태(표준)
            elif isinstance(elem, (list, tuple)):
                # 보통 [poly, (text, score), ...] 구조
                if len(elem) >= 2:
                    poly_candidate = elem[0]
                    ts_candidate   = elem[1]
                    # poly 후보
                    if isinstance(poly_candidate, (list, tuple)) and len(poly_candidate) >= 3:
                        poly = [[int(p[0]), int(p[1])] for p in poly_candidate]
                    # text,score 후보
                    if isinstance(ts_candidate, (list, tuple)) and len(ts_candidate) >= 2:
                        txt   = str(ts_candidate[0])
                        try:
                            score = float(ts_candidate[1])
                        except Exception:
                            score = 0.0
                    else:
                        txt = str(ts_candidate)

                # 혹시 모르는 3번째 이후 요소에서 보조정보가 올 수도 있지만, 여기선 무시

            # 점수 필터/형식 정리
            if poly is None or not isinstance(poly, (list, tuple)) or len(poly) < 3:
                continue
            if score is None:
                score = 0.0
            if float(score) < float(min_score):
                continue

            # poly 정규화
            poly_int = []
            try:
                for p in poly:
                    if isinstance(p, (list, tuple)) and len(p) >= 2:
                        poly_int.append([int(round(float(p[0]))), int(round(float(p[1])))])
                if len(poly_int) < 3:
                    continue
            except Exception:
                continue

            bbox, center = _poly_to_bbox_and_center(poly_int)
            items.append({
                "text": txt,
                "score": float(score),
                "poly": poly_int,
                "bbox": bbox,        # [x1,y1,x2,y2]
                "center": center,    # [cx,cy]
            })
    return items


def _file_to_bgr(file_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image bytes.")
    return img

def _poly_to_bbox_and_center(poly: List[List[float]]) -> Tuple[List[int], List[float]]:
    xs = [float(p[0]) for p in poly]
    ys = [float(p[1]) for p in poly]
    x1, x2 = int(min(xs)), int(max(xs))
    y1, y2 = int(min(ys)), int(max(ys))
    cx = float(sum(xs) / max(1, len(xs)))
    cy = float(sum(ys) / max(1, len(ys)))
    return [x1, y1, x2, y2], [cx, cy]

@app.post("/ocr/extract")
async def ocr_extract(
    file: UploadFile = File(...),
    min_score: float = Form(0.5),
    return_mask: bool = Form(True),
    mask_dilate: int = Form(2),
):
    """
    OCR 결과(JSON) + (옵션) 텍스트 마스크 PNG 경로 반환
    - lines: [{text, score, poly:[[x,y],...]}...]
    - items: [{text, score, poly, bbox:[x1,y1,x2,y2], center:[cx,cy]}...]
    - text_mask_path: (옵션) 생성된 마스크 경로
    """
    b = await file.read()
    bgr = _file_to_bgr(b)
    h, w = bgr.shape[:2]

    # PaddleOCR 결과: [[[poly(4x2), (text, score)], ...], ...] 형식
    # NOTE: 일부 버전에선 predict(cls=...) 시그니처가 다르므로 cls 인자 사용 안 함
    result = ocr.ocr(bgr)

    items = _parse_paddle_result(result, min_score=float(min_score))
    lines = [{"text": it["text"], "score": it["score"], "poly": it["poly"]} for it in items]

    # (선택) 텍스트 마스크 생성
    polys_for_mask: List[np.ndarray] = [np.array(it["poly"], dtype=np.int32) for it in items]

    resp: Dict[str, Any] = {
        "ok": True,
        "h": h,
        "w": w,
        "count": len(lines),
        "lines": lines,    # 하위호환용
        "items": items,    # 권장
    }

    if return_mask:
        mask = np.zeros((h, w), np.uint8)
        if len(polys_for_mask) > 0:
            cv2.fillPoly(mask, polys_for_mask, 255)
            if int(mask_dilate) > 0:
                k = cv2.getStructuringElement(
                    cv2.MORPH_ELLIPSE,
                    (int(mask_dilate), int(mask_dilate)),
                )
                mask = cv2.dilate(mask, k, 1)
        out_path = OUT_DIR / f"{Path(file.filename).stem}_textmask.png"  # ← 오타 수정됨
        cv2.imwrite(str(out_path), mask)
        resp["text_mask_path"] = str(out_path)

    return resp


@app.post("/ocr/overlay_html")
async def ocr_overlay_html(
    file: UploadFile = File(...),
    min_score: float = Form(0.5),
    font_px: int = Form(12),
):
    """원본 위에 인식 텍스트를 같은 위치에 뿌리는 간단 HTML(디버그용)"""
    b = await file.read()
    bgr = _file_to_bgr(b)
    h, w = bgr.shape[:2]
    result = ocr.ocr(bgr)

    labels = []
    for block in result:
        for poly, (txt, score) in block:
            if score is None or float(score) < float(min_score):
                continue
            cx = int(np.mean([p[0] for p in poly]))
            cy = int(np.mean([p[1] for p in poly]))
            labels.append(f"<div class='lb' style='left:{cx}px;top:{cy}px;'>{txt}</div>")

    _, buf = cv2.imencode(".png", bgr)
    data_uri = "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode("ascii")

    html = f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>OCR Overlay</title>
    <style>
      body,html {{ margin:0; padding:0; }}
      .wrap {{ position:relative; display:inline-block; }}
      img.base {{ display:block; max-width:100%; }}
      .lb {{
        position:absolute; transform:translate(-50%,-50%);
        background:rgba(0,0,0,.65); color:#fff; padding:2px 4px; border-radius:4px;
        font:{max(8, int(font_px))}px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial;
        pointer-events:none; white-space:nowrap;
      }}
    </style>
  </head>
  <body>
    <div class="wrap">
      <img class="base" src="{data_uri}" width="{w}" height="{h}" />
      {''.join(labels)}
    </div>
  </body>
</html>"""
    return HTMLResponse(html)

# Run:
#   uvicorn ocr_service:app --host 0.0.0.0 --port 8100
# Swagger:
#   http://localhost:8100/docs
