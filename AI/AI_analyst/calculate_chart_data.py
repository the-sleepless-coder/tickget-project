# calculate_chart_data.py
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import List, Optional

import pandas as pd
from pydantic import BaseModel, Field


class AggregatedStats(BaseModel):
    total_sessions: int
    success_rate: float
    avg_select_time: Optional[float] = None
    median_select_time: Optional[float] = None
    avg_miss_count: Optional[float] = None
    best_rank: Optional[int] = None
    worst_rank: Optional[int] = None


class PerMatchStat(BaseModel):
    match_id: int
    success: bool
    select_time: Optional[float] = None
    miss_count: Optional[int] = None
    final_rank: Optional[int] = None
    created_at: datetime


class DailySummary(BaseModel):
    date: str  # YYYY-MM-DD
    sessions: int
    success_rate: float
    avg_select_time: Optional[float] = None
    avg_miss_count: Optional[float] = None


class LevelReachStat(BaseModel):
    """
    레벨별( beginner / expert / pro ) 분포 및 해당 레벨에서의 성공률
    - level: "beginner" | "expert" | "pro"
    - count: 해당 레벨에 속한 전체 세션 수
    - ratio: 전체 세션 대비 비율 (0.0 ~ 1.0)
    - success_rate: 그 레벨 세션들 중 성공(is_success=1) 비율
    """
    level: str
    count: int
    ratio: float
    success_rate: float


class ChartData(BaseModel):
    """
    프론트(Recharts) + LLM에 공통으로 넘길 수 있는 데이터 구조.
    """
    window_days: int
    user_id: Optional[int] = None
    aggregated: AggregatedStats
    by_match: List[PerMatchStat]
    by_day: List[DailySummary]
    level_reach: List[LevelReachStat] = Field(default_factory=list)


def calculate_chart_data(
    user_stats_df: pd.DataFrame,
    window_days: int = 7,
    user_id: Optional[int] = None,
) -> ChartData:
    """
    user_stats DataFrame을 받아서:
    - 최근 window_days일 데이터만 필터링하고
    - (선택) 특정 user_id만 필터링한 뒤
    - 그래프/LLM에 쓰기 좋은 aggregated / by_match / by_day / level_reach 구조로 정리한다.

    예상하는 컬럼 이름 (MySQL user_stats 기준):
      - user_id (int)
      - created_at (datetime)
      - is_success (0/1 또는 bool)
      - date_select_time (float, 초 단위)
      - date_miss_count (int)
      - total_rank (int, 선택)
      - match_id (int)
      - user_rank (int, 선택: 레벨 분포 계산에 사용)
    """
    def _empty_chart_data() -> ChartData:
        empty_agg = AggregatedStats(
            total_sessions=0,
            success_rate=0.0,
            avg_select_time=None,
            median_select_time=None,
            avg_miss_count=None,
            best_rank=None,
            worst_rank=None,
        )
        return ChartData(
            window_days=window_days,
            user_id=user_id,
            aggregated=empty_agg,
            by_match=[],
            by_day=[],
            level_reach=[],
        )

    if user_stats_df is None or user_stats_df.empty:
        return _empty_chart_data()

    df = user_stats_df.copy()

    # user_id 필터
    if user_id is not None and "user_id" in df.columns:
        df = df[df["user_id"] == user_id]

    if df.empty:
        return _empty_chart_data()

    # created_at 필터
    if "created_at" in df.columns:
        created = pd.to_datetime(df["created_at"], errors="coerce", utc=True)
        cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
        df = df[created >= cutoff]
        df = df.assign(_created_at_dt=created[created >= cutoff])
    else:
        df = df.assign(_created_at_dt=datetime.now(timezone.utc))

    if df.empty:
        return _empty_chart_data()

    # 타입 정리
    if "is_success" in df.columns:
        df["is_success"] = df["is_success"].astype(int)
    else:
        df["is_success"] = 0

    if "date_select_time" in df.columns:
        df["date_select_time"] = pd.to_numeric(
            df["date_select_time"], errors="coerce"
        )
    else:
        df["date_select_time"] = pd.NA

    if "date_miss_count" in df.columns:
        df["date_miss_count"] = pd.to_numeric(
            df["date_miss_count"], errors="coerce"
        )
    else:
        df["date_miss_count"] = pd.NA

    if "total_rank" not in df.columns:
        df["total_rank"] = pd.NA

    # ----- AggregatedStats -----
    total_sessions = len(df)
    success_rate = float(df["is_success"].mean()) if total_sessions > 0 else 0.0

    if df["date_select_time"].notna().any():
        avg_select_time = float(df["date_select_time"].mean())
        median_select_time = float(df["date_select_time"].median())
    else:
        avg_select_time = None
        median_select_time = None

    if df["date_miss_count"].notna().any():
        avg_miss_count = float(df["date_miss_count"].mean())
    else:
        avg_miss_count = None

    # best/worst rank (값이 있는 행만)
    rank_series = pd.to_numeric(df["total_rank"], errors="coerce").dropna()
    best_rank = int(rank_series.min()) if not rank_series.empty else None
    worst_rank = int(rank_series.max()) if not rank_series.empty else None

    aggregated = AggregatedStats(
        total_sessions=total_sessions,
        success_rate=success_rate,
        avg_select_time=avg_select_time,
        median_select_time=median_select_time,
        avg_miss_count=avg_miss_count,
        best_rank=best_rank,
        worst_rank=worst_rank,
    )

    # ----- by_match (Recharts용 개별 경기 데이터) -----
    by_match: List[PerMatchStat] = []
    df_sorted = df.sort_values("_created_at_dt")

    for _, row in df_sorted.iterrows():
        match_id_val = int(row["match_id"]) if "match_id" in row and pd.notna(row["match_id"]) else -1
        created_at_val = row["_created_at_dt"]
        if not isinstance(created_at_val, datetime):
            created_at_val = datetime.now(timezone.utc)

        select_time_val: Optional[float] = None
        if pd.notna(row["date_select_time"]):
            select_time_val = float(row["date_select_time"])

        miss_count_val: Optional[int] = None
        if pd.notna(row["date_miss_count"]):
            miss_count_val = int(row["date_miss_count"])

        final_rank_val: Optional[int] = None
        if pd.notna(row["total_rank"]):
            final_rank_val = int(row["total_rank"])

        by_match.append(
            PerMatchStat(
                match_id=match_id_val,
                success=bool(row["is_success"]),
                select_time=select_time_val,
                miss_count=miss_count_val,
                final_rank=final_rank_val,
                created_at=created_at_val,
            )
        )

    # ----- by_day (일별 집계) -----
    by_day: List[DailySummary] = []
    df_day = df_sorted.copy()
    df_day["date_str"] = df_day["_created_at_dt"].dt.strftime("%Y-%m-%d")
    grouped = df_day.groupby("date_str")

    for date_str, g in grouped:
        sessions = len(g)
        success_rate_day = float(g["is_success"].mean()) if sessions > 0 else 0.0

        avg_select_time_day: Optional[float] = None
        avg_miss_count_day: Optional[float] = None

        if g["date_select_time"].notna().any():
            avg_select_time_day = float(g["date_select_time"].mean())
        if g["date_miss_count"].notna().any():
            avg_miss_count_day = float(g["date_miss_count"].mean())

        by_day.append(
            DailySummary(
                date=date_str,
                sessions=sessions,
                success_rate=success_rate_day,
                avg_select_time=avg_select_time_day,
                avg_miss_count=avg_miss_count_day,
            )
        )

    # ----- Level별 도달 비율 / 성공률 -----
    level_reach: List[LevelReachStat] = []

    if "user_rank" in df.columns:
        tmp = df.copy()
        tmp["user_rank"] = pd.to_numeric(tmp["user_rank"], errors="coerce")
        tmp = tmp[tmp["user_rank"].notna()]

        def _map_rank_to_level_local(rank: float) -> str:
            r = int(rank)
            if r == 1:
                return "pro"
            elif r in (2, 3):
                return "expert"
            else:
                return "beginner"

        if not tmp.empty:
            tmp["level"] = tmp["user_rank"].apply(_map_rank_to_level_local)
            total_level_rows = len(tmp)

            for lvl in ("beginner", "expert", "pro"):
                sub = tmp[tmp["level"] == lvl]
                if sub.empty:
                    continue

                count = len(sub)
                ratio = count / total_level_rows if total_level_rows > 0 else 0.0
                success_rate_level = (
                    float(sub["is_success"].mean())
                    if "is_success" in sub.columns
                    else 0.0
                )

                level_reach.append(
                    LevelReachStat(
                        level=lvl,
                        count=count,
                        ratio=ratio,
                        success_rate=success_rate_level,
                    )
                )

    return ChartData(
        window_days=window_days,
        user_id=user_id,
        aggregated=aggregated,
        by_match=by_match,
        by_day=by_day,
        level_reach=level_reach,
    )
