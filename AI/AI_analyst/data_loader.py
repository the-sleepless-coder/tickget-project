from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Tuple, Optional

import os
import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient
from sqlalchemy import create_engine, text

# .env 로드
load_dotenv()


def _as_bool(value: Optional[str], default: bool = False) -> bool:
    """문자열 환경변수를 bool로 바꿔주는 헬퍼."""
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "y", "on")


# ---------------------------------------------------------------------
# 1) MongoDB: 지난 N일 user_log / seat_log 가져오기
# ---------------------------------------------------------------------
def fetch_mongo_logs(
    days: int = 7,
    use_local: Optional[bool] = None,
    user_collection: str = "user_log",
    seat_collection: str = "seat_confirmation_logs",
    debug: bool = True,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    MongoDB에서 지난 `days`일 동안의 큐/좌석 로그를 가져와 DataFrame 두 개로 반환.

    - user_collection: 큐 로그 컬렉션 이름 (기본: "user_log")
    - seat_collection: 좌석 로그 컬렉션 이름 (원격: "seat_confirmation_logs", 로컬이면 "seat_log"로 바꿔 호출)
    - use_local:
        * None  -> USE_LOCAL_ENV 환경변수 따라감
        * True  -> LOCAL_MONGO_URI / LOCAL_MONGO_DB 사용
        * False -> MONGO_URI / MONGO_DB 사용
    """
    # 어떤 환경 쓸지 결정
    if use_local is None:
        use_local = _as_bool(os.getenv("USE_LOCAL_ENV"), default=False)

    if use_local:
        mongo_uri = os.getenv("LOCAL_MONGO_URI")
        mongo_db_name = os.getenv("LOCAL_MONGO_DB")
    else:
        mongo_uri = os.getenv("MONGO_URI")
        mongo_db_name = os.getenv("MONGO_DB")

    if not mongo_uri:
        raise RuntimeError("Mongo URI가 설정되어 있지 않습니다 (MONGO_URI / LOCAL_MONGO_URI).")
    if not mongo_db_name:
        raise RuntimeError("Mongo DB 이름이 설정되어 있지 않습니다 (MONGO_DB / LOCAL_MONGO_DB).")

    client = MongoClient(mongo_uri)
    db = client[mongo_db_name]

    since = datetime.now(timezone.utc) - timedelta(days=days)

    user_col = db[user_collection]
    seat_col = db[seat_collection]

    # QueueLogDTO
    user_query = {
        "_class": "com.ticketing.queue.DTO.QueueLogDTO",
        "timeStamp": {"$gte": since},
    }

    # SeatConfirmationLog
    seat_query = {
        "_class": "com.ticketing.seat.mongodb.SeatConfirmationLog",
        "timestamp": {"$gte": since},
    }

    user_docs = list(user_col.find(user_query))
    seat_docs = list(seat_col.find(seat_query))

    user_df = pd.DataFrame(user_docs)
    seat_df = pd.DataFrame(seat_docs)

    if debug:
        print(f"[Mongo] use_local={use_local}, db={mongo_db_name}")
        print(f"[Mongo] user_log docs: {len(user_df)} | seat_log docs: {len(seat_df)}")
        print("\n[user_log head]")
        print(user_df.head(5))
        print("\n[seat_log head]")
        print(seat_df.head(5))
        print()

    return user_df, seat_df


# ---------------------------------------------------------------------
# 2) MySQL: user_stats 일부 가져오기
# ---------------------------------------------------------------------
def fetch_mysql_user_stats(
    limit: int = 10,
    use_local: Optional[bool] = None,
    debug: bool = True,
) -> pd.DataFrame:
    """
    MySQL에서 user_stats를 가져와 DataFrame으로 반환.

    - use_local:
        * None  -> USE_ENV / USE_LOCAL_DB 환경변수 따라감
        * True  -> LOCAL_MYSQL_URL 사용 (로컬 docker용)
        * False -> MYSQL_URL 사용 (SSAFY 클라우드용)
    """
    # 어떤 환경 쓸지 결정
    if use_local is None:
        # 둘 중 하나라도 true면 로컬로 본다
        use_local = _as_bool(os.getenv("USE_ENV")) or _as_bool(
            os.getenv("USE_LOCAL_DB")
        )

    if use_local:
        mysql_url = os.getenv("LOCAL_MYSQL_URL")
    else:
        mysql_url = os.getenv("MYSQL_URL")

    if not mysql_url:
        raise RuntimeError(
            "MySQL URL이 설정되어 있지 않습니다 (MYSQL_URL / LOCAL_MYSQL_URL)."
        )

    engine = create_engine(mysql_url)

    if debug:
        with engine.connect() as conn:
            tables = conn.execute(text("SHOW TABLES")).fetchall()
            print("=== MySQL TABLES ===")
            for row in tables:
                print("-", row[0])

    query = f"""
        SELECT *
        FROM user_stats
        LIMIT {int(limit)}
    """

    df = pd.read_sql(text(query), engine)

    if debug:
        print("\n[user_stats head]")
        print(df.head())
        print()

    return df


# ---------------------------------------------------------------------
# 3) 예시: 이 파일만 직접 실행했을 때 동작 (간단 테스트)
# ---------------------------------------------------------------------
if __name__ == "__main__":
    # Mongo: 원격 SSAFY 기준 예시 (seat 컬렉션 이름 그대로)
    user_df, seat_df = fetch_mongo_logs(days=7, use_local=False)

    # MySQL: 로컬 docker 기준 예시
    stats_df = fetch_mysql_user_stats(limit=10, use_local=True)

    # 필요하면 샘플 CSV로 저장
    user_df.to_csv("user_cols_sample.csv", index=False)
    seat_df.to_csv("seat_logs_sample.csv", index=False)
    stats_df.to_csv("user_stats_sample.csv", index=False)

    print("✅ 샘플 CSV 저장 완료")
