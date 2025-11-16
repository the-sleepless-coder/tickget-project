# bot_params_core.py
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Dict, Literal

import math
import pandas as pd
from pydantic import BaseModel, Field


# =========================
# Pydantic 모델 정의
# =========================

class DelayConfigModel(BaseModel):
    select_day_base: int = Field(..., description="요일 선택 기본 딜레이(ms)")
    select_day_variance: int = Field(..., description="요일 선택 변동폭(ms)")
    captcha_base: int = Field(..., description="캡차 풀이 기본 딜레이(ms)")
    captcha_variance: int = Field(..., description="캡차 풀이 변동폭(ms)")
    select_seat_base: int = Field(..., description="좌석 선택 기본 딜레이(ms)")
    select_seat_variance: int = Field(..., description="좌석 선택 변동폭(ms)")
    jitter_range: float = Field(..., description="좌석 점수에 추가될 랜덤 변동폭")
    retry_delay_ms: int = Field(..., description="재시도 딜레이(ms)")
    candidate_count: int = Field(..., description="좌석 후보 개수")


class LevelConfigModel(BaseModel):
    name: Literal["beginner", "expert", "pro"]
    delay: DelayConfigModel
    sample_count: int = Field(..., description="이 레벨 분석에 사용된 user_stats 행 개수")


class DistributionModel(BaseModel):
    beginner: int
    expert: int
    pro: int


class BotParamConfig(BaseModel):
    generated_at: datetime
    window_days: int
    total_samples: int
    levels: Dict[str, LevelConfigModel]
    distributions: Dict[str, DistributionModel]


# =========================
# level.go / distribution.go 기반 기본값
# =========================

DEFAULT_DELAY: Dict[str, DelayConfigModel] = {
    "beginner": DelayConfigModel(
        select_day_base=2500,
        select_day_variance=300,
        captcha_base=5000,
        captcha_variance=500,
        select_seat_base=2000,
        select_seat_variance=300,
        jitter_range=50.0,
        retry_delay_ms=300,
        candidate_count=4,
    ),
    "expert": DelayConfigModel(
        select_day_base=1500,
        select_day_variance=200,
        captcha_base=5000,
        captcha_variance=300,
        select_seat_base=3500,
        select_seat_variance=200,
        jitter_range=15.0,
        retry_delay_ms=100,
        candidate_count=3,
    ),
    "pro": DelayConfigModel(
        select_day_base=800,
        select_day_variance=100,
        captcha_base=3000,
        captcha_variance=150,
        select_seat_base=2000,
        select_seat_variance=100,
        jitter_range=5.0,
        retry_delay_ms=50,
        candidate_count=3,
    ),
}

DEFAULT_DISTRIBUTION: Dict[str, DistributionModel] = {
    "easy": DistributionModel(beginner=70, expert=20, pro=10),
    "medium": DistributionModel(beginner=30, expert=50, pro=20),
    "hard": DistributionModel(beginner=10, expert=30, pro=60),
}


# =========================
# user_rank -> level 매핑 규칙
# =========================

def map_rank_to_level(rank: int) -> str:
    """
    user_stats.user_rank를 봇 레벨로 매핑.
    - rank 1   -> pro
    - rank 2,3 -> expert
    - rank 4,5 -> beginner
    """
    if rank == 1:
        return "pro"
    elif rank in (2, 3):
        return "expert"
    else:
        return "beginner"


# =========================
# 통계 → DelayConfig 변환
# =========================

def compute_delay_for_level(level: str, df_level: pd.DataFrame) -> DelayConfigModel:
    """
    특정 레벨(beginner/expert/pro)에 대한 date_select_time 분포를 이용해
    select_seat_base / variance를 유저와 비슷하게 맞추고,
    나머지 필드는 기본값 유지.
    """
    base_default = DEFAULT_DELAY[level]

    if df_level.empty:
        return base_default

    if "date_select_time" not in df_level.columns:
        return base_default

    s = df_level["date_select_time"].dropna().astype(float)
    if s.empty:
        return base_default

    # 분위수 기반 (이상치 방지)
    q10 = s.quantile(0.10)
    q50 = s.quantile(0.50)
    q90 = s.quantile(0.90)

    base_ms = int(math.floor(q50 * 1000))
    var_ms = int(math.floor(max(q50 - q10, q90 - q50) * 1000))

    if base_ms < 300:
        base_ms = 300
    if var_ms < 50:
        var_ms = 50

    return DelayConfigModel(
        select_day_base=base_default.select_day_base,
        select_day_variance=base_default.select_day_variance,
        captcha_base=base_default.captcha_base,
        captcha_variance=base_default.captcha_variance,
        select_seat_base=base_ms,
        select_seat_variance=var_ms,
        jitter_range=base_default.jitter_range,
        retry_delay_ms=base_default.retry_delay_ms,
        candidate_count=base_default.candidate_count,
    )


def _build_from_level_df(df_levelled: pd.DataFrame, window_days: int) -> BotParamConfig:
    """
    이미 level 컬럼이 있는 DataFrame을 받아, 레벨별 DelayConfig를 계산.
    (내부용)
    """
    total_samples = len(df_levelled)
    level_configs: Dict[str, LevelConfigModel] = {}

    for level in ("beginner", "expert", "pro"):
        df_level = df_levelled[df_levelled["level"] == level]
        delay_cfg = compute_delay_for_level(level, df_level)
        level_configs[level] = LevelConfigModel(
            name=level,
            delay=delay_cfg,
            sample_count=len(df_level),
        )

    return BotParamConfig(
        generated_at=datetime.now(timezone.utc),
        window_days=window_days,
        total_samples=total_samples,
        levels=level_configs,
        distributions=DEFAULT_DISTRIBUTION,
    )


def compute_bot_params_from_user_stats(
    stats_df: pd.DataFrame,
    window_days: int,
) -> BotParamConfig:
    """
    전체 user_stats DataFrame을 받아서:
    - 최근 window_days일
    - is_success = 1
    - user_rank -> beginner/expert/pro
    를 적용한 뒤, BotParamConfig를 계산한다.
    """
    if stats_df is None or stats_df.empty:
        # 완전 비었으면 그냥 기본값
        return BotParamConfig(
            generated_at=datetime.now(timezone.utc),
            window_days=window_days,
            total_samples=0,
            levels={
                lvl: LevelConfigModel(
                    name=lvl,
                    delay=cfg,
                    sample_count=0,
                )
                for lvl, cfg in DEFAULT_DELAY.items()
            },
            distributions=DEFAULT_DISTRIBUTION,
        )

    df = stats_df.copy()

    # created_at 컬럼 시간 필터
    if "created_at" in df.columns:
        created = pd.to_datetime(df["created_at"], errors="coerce", utc=True)
        cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
        df = df[created >= cutoff]

    # 성공만
    if "is_success" in df.columns:
        df = df[df["is_success"] == 1]

    if df.empty:
        return BotParamConfig(
            generated_at=datetime.now(timezone.utc),
            window_days=window_days,
            total_samples=0,
            levels={
                lvl: LevelConfigModel(
                    name=lvl,
                    delay=cfg,
                    sample_count=0,
                )
                for lvl, cfg in DEFAULT_DELAY.items()
            },
            distributions=DEFAULT_DISTRIBUTION,
        )

    # user_rank -> level
    if "user_rank" in df.columns:
        df["user_rank"] = df["user_rank"].astype(int)
        df["level"] = df["user_rank"].apply(map_rank_to_level)
    else:
        # user_rank 없으면 전부 beginner로 취급
        df["level"] = "beginner"

    return _build_from_level_df(df, window_days)
