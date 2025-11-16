# analysis_main.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

import os
import httpx
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

# ---- 공통 데이터 로더 / 계산 모듈 ----
from data_loader import fetch_mysql_user_stats

from bot_params_core import (
    BotParamConfig,
    compute_bot_params_from_user_stats,
)

from calculate_chart_data import (
    ChartData,
    calculate_chart_data,
)

from LLM_main import (
    SYSTEM_PROMPT_USER_REPORT,
    SYSTEM_PROMPT_TOAST,
    build_user_report_prompt,
    build_session_toast_prompt,
)


# =========================
# FastAPI 앱
# =========================

app = FastAPI(
    title="Tick-get BotParam + Analyzer API",
    version="0.1.0",
)


@app.get("/health")
async def health_check():
    return {"ok": True, "timestamp": datetime.now(timezone.utc).isoformat()}


# =========================
# GMS 호출 유틸
# =========================

async def call_gms_chat(system_prompt: str, user_prompt: str) -> str:
    """
    GMS(OpenAI 호환) ChatCompletion 호출.

    필요 ENV:
      - GMS_CHAT_URL : 전체 엔드포인트 URL (예: https://gms.example.com/v1/chat/completions)
      - GMS_API_KEY  : Bearer 토큰
      - GMS_MODEL    : 사용할 모델 이름 (예: gpt-4o-mini)
    """
    chat_url = os.getenv("GMS_CHAT_URL")
    api_key = os.getenv("GMS_API_KEY")
    model = os.getenv("GMS_MODEL", "gpt-4o-mini")

    if not chat_url or not api_key or not model:
        raise RuntimeError("GMS_CHAT_URL / GMS_API_KEY / GMS_MODEL 환경변수를 확인하세요.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(chat_url, headers=headers, json=payload)

    if resp.status_code != 200:
        raise RuntimeError(f"GMS 응답 에러: {resp.status_code} {resp.text}")

    data = resp.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except Exception:
        raise RuntimeError(f"GMS 응답 파싱 실패: {data}")

    return content


# =========================
# 1) Go 봇 파라미터 JSON API
# =========================

@app.get("/bot-params", response_model=BotParamConfig)
async def get_bot_params(
    days: int = Query(7, ge=1, le=60, description="최근 N일 기준 분석"),
    use_local: bool = Query(False, description="LOCAL_MYSQL_URL 사용 여부"),
    limit: int = Query(
        1000,
        ge=1,
        le=100000,
        description="user_stats에서 가져올 최대 행 수",
    ),
    save_to_file: bool = Query(
        False,
        description="True일 경우 BOT_PARAM_OUT 경로에 JSON 저장",
    ),
):
    """
    최근 N일간의 user_stats (성공 로그 중심)를 기반으로
    beginner / expert / pro 봇 딜레이 파라미터를 계산해서 반환한다.
    Go 서버는 이 JSON을 정적 파일처럼 읽어가면 됨.
    """
    try:
        stats_df = fetch_mysql_user_stats(
            limit=limit,
            use_local=use_local,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MySQL 조회 중 오류: {e}")

    config = compute_bot_params_from_user_stats(
        stats_df=stats_df,
        window_days=days,
    )

    if save_to_file:
        out_path = os.getenv("BOT_PARAM_OUT", "bot_params.json")
        try:
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(config.model_dump_json(indent=2, ensure_ascii=False))
            print(f"[bot-params] JSON saved to {out_path}")
        except Exception as e:
            print(f"[bot-params] 파일 저장 실패: {e}")

    return config


# =========================
# 2) Recharts용 차트 데이터 API
# =========================

@app.get("/chart-data", response_model=ChartData)
async def get_chart_data(
    days: int = Query(7, ge=1, le=60, description="최근 N일 기준"),
    use_local: bool = Query(False, description="LOCAL_MYSQL_URL 사용 여부"),
    limit: int = Query(
        1000,
        ge=1,
        le=100000,
        description="user_stats에서 가져올 최대 행 수",
    ),
    user_id: Optional[int] = Query(
        None,
        description="특정 user_id만 필터링 (없으면 전체 기준)",
    ),
):
    """
    프론트(Recharts) + LLM이 공통으로 사용할 차트용 집계 데이터.
    """
    try:
        stats_df = fetch_mysql_user_stats(
            limit=limit,
            use_local=use_local,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MySQL 조회 중 오류: {e}")

    chart = calculate_chart_data(
        user_stats_df=stats_df,
        window_days=days,
        user_id=user_id,
    )
    return chart


# =========================
# 3) 전체 분석 리포트 프롬프트 API (프롬프트만)
# =========================

class UserReportPromptResponse(BaseModel):
    system_prompt: str
    user_prompt: str
    chart_data: ChartData
    bot_params: BotParamConfig


@app.get("/user-report-prompt", response_model=UserReportPromptResponse)
async def get_user_report_prompt(
    days: int = Query(7, ge=1, le=60, description="최근 N일 기준"),
    use_local: bool = Query(False, description="LOCAL_MYSQL_URL 사용 여부"),
    limit: int = Query(
        1000,
        ge=1,
        le=100000,
        description="user_stats에서 가져올 최대 행 수",
    ),
    user_id: Optional[int] = Query(
        None,
        description="특정 user_id만 대상으로 리포트 생성",
    ),
):
    """
    LLM 전체 분석 리포트용 system + user 프롬프트를 생성해서 내려준다.
    - 실제 LLM 호출(GMS/OpenAI)은 다른 서비스에서 수행.
    """
    try:
        stats_df = fetch_mysql_user_stats(
            limit=limit,
            use_local=use_local,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MySQL 조회 중 오류: {e}")

    # 같은 raw 데이터로 차트 + 봇 파라미터 둘 다 계산
    chart = calculate_chart_data(
        user_stats_df=stats_df,
        window_days=days,
        user_id=user_id,
    )
    bot_config = compute_bot_params_from_user_stats(
        stats_df=stats_df,
        window_days=days,
    )

    user_prompt = build_user_report_prompt(
        chart_data=chart,
        user_profile=None,  # 나중에 users 테이블 붙이면 여기서 넣기
        bot_params=bot_config.model_dump(),
    )

    return UserReportPromptResponse(
        system_prompt=SYSTEM_PROMPT_USER_REPORT,
        user_prompt=user_prompt,
        chart_data=chart,
        bot_params=bot_config,
    )


# =========================
# 4) 전체 분석 리포트 LLM 호출 API
# =========================

class UserReportLLMResponse(BaseModel):
    text: str  # LLM이 생성한 최종 리포트 텍스트


@app.get("/user-report-llm", response_model=UserReportLLMResponse)
async def get_user_report_llm(
    days: int = Query(7, ge=1, le=60, description="최근 N일 기준"),
    use_local: bool = Query(False, description="LOCAL_MYSQL_URL 사용 여부"),
    limit: int = Query(
        1000,
        ge=1,
        le=100000,
        description="user_stats에서 가져올 최대 행 수",
    ),
    user_id: Optional[int] = Query(
        None,
        description="특정 user_id만 대상으로 리포트 생성",
    ),
):
    """
    GMS까지 호출해서 최종 한국어 분석 리포트 텍스트를 반환한다.
    프론트/백엔드는 이 엔드포인트만 호출해도 바로 마이페이지 'AI 분석 리포트'를 표시할 수 있다.
    """
    try:
        stats_df = fetch_mysql_user_stats(
            limit=limit,
            use_local=use_local,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MySQL 조회 중 오류: {e}")

    chart = calculate_chart_data(
        user_stats_df=stats_df,
        window_days=days,
        user_id=user_id,
    )
    bot_config = compute_bot_params_from_user_stats(
        stats_df=stats_df,
        window_days=days,
    )

    user_prompt = build_user_report_prompt(
        chart_data=chart,
        user_profile=None,
        bot_params=bot_config.model_dump(),
    )

    try:
        text = await call_gms_chat(
            system_prompt=SYSTEM_PROMPT_USER_REPORT,
            user_prompt=user_prompt,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GMS 호출 중 오류: {e}")

    return UserReportLLMResponse(text=text)


# =========================
# 5) 한 경기 토스트용 프롬프트 / LLM API
# =========================

class SessionToastRequest(BaseModel):
    difficulty: str  # "easy" | "medium" | "hard"
    select_time: Optional[float] = None  # 초 단위
    miss_count: Optional[int] = None
    success: bool
    final_rank: Optional[int] = None
    created_at: Optional[datetime] = None


class SessionToastPromptResponse(BaseModel):
    system_prompt: str
    user_prompt: str


@app.post("/session-toast-prompt", response_model=SessionToastPromptResponse)
async def get_session_toast_prompt(req: SessionToastRequest):
    """
    방금 끝난 한 경기 결과로 LLM 토스트용 프롬프트를 생성한다.
    - 프론트는 이 프롬프트를 LLM에 보내고, 리턴된 2~3줄 텍스트를 토스트로 띄우면 됨.
    """
    user_prompt = build_session_toast_prompt(
        difficulty=req.difficulty,
        select_time=req.select_time,
        miss_count=req.miss_count,
        success=req.success,
        final_rank=req.final_rank,
        created_at=req.created_at,
    )

    return SessionToastPromptResponse(
        system_prompt=SYSTEM_PROMPT_TOAST,
        user_prompt=user_prompt,
    )


class SessionToastLLMResponse(BaseModel):
    text: str  # LLM이 생성한 최종 토스트 메시지 텍스트


@app.post("/session-toast-llm", response_model=SessionToastLLMResponse)
async def get_session_toast_llm(req: SessionToastRequest):
    """
    방금 끝난 한 경기 결과로 GMS까지 호출해 최종 토스트 메시지를 반환한다.
    """
    user_prompt = build_session_toast_prompt(
        difficulty=req.difficulty,
        select_time=req.select_time,
        miss_count=req.miss_count,
        success=req.success,
        final_rank=req.final_rank,
        created_at=req.created_at,
    )

    try:
        text = await call_gms_chat(
            system_prompt=SYSTEM_PROMPT_TOAST,
            user_prompt=user_prompt,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GMS 호출 중 오류: {e}")

    return SessionToastLLMResponse(text=text)


# 실행 예:
# uvicorn analysis_main:app --host 0.0.0.0 --port 8200 --reload
# http://localhost:8200/docs
