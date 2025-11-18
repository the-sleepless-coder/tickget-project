# LLM_main.py
from __future__ import annotations

"""
Tick-get AI 분석관 - LLM 프롬프트 관리 모듈

역할:
- 차트/통계 데이터(ChartData)를 받아서 LLM에게 줄 user_prompt를 만든다.
- GMS 호출은 analysis_main.py에서 처리하고,
  여기서는 "프롬프트 문자열"만 책임진다.
"""

from datetime import datetime
from typing import Any, Dict, Optional

import json
import pandas as pd
from pydantic import BaseModel, Field


# =========================
# 사용자 프로필(선택 사항)
# =========================

class UserProfile(BaseModel):
    user_id: int
    nickname: Optional[str] = None
    joined_days: Optional[int] = Field(
        default=None,
        description="서비스 사용 일수(선택)",
    )


# =========================
# 시스템 프롬프트 (역할 정의)
# =========================

SYSTEM_PROMPT_USER_REPORT = """
당신은 온라인 티켓팅 연습 서비스 'Tick-get'의 AI 분석관입니다.

- 사용자는 실전과 유사한 환경에서 티켓팅 연습을 반복합니다.
- 당신의 역할은 사용자의 최근 연습 기록을 기반으로,
  객관적인 지표와 함께 현실적인 피드백과 개선 전략을 제안하는 것입니다.
- 사용자는 10대부터 50대 이상까지 연령대가 다양하며,
  직업도 특정되지 않은 일반 사용자입니다. 따라서
  특정 직업/연령을 가정하는 표현(예: '학생이시라면', '회사원이시라면')은 피해주세요.
- 대신 "티켓팅을 자주 연습하는 사람", "연습을 시작한 지 얼마 안 된 사람"처럼
  누구에게나 적용 가능한 표현을 사용하세요.

리포트 작성 시 지켜야 할 규칙:
1) 존댓말(반말 금지)로 작성합니다.
2) 사용자의 실력이나 성향을 과도하게 단정하거나 비하하지 않습니다.
3) '운'보다는 사용자가 조절할 수 있는 부분(속도, 전략, 패턴)에 초점을 둡니다.
4) 너무 추상적인 조언(예: "더 노력하세요")은 피하고,
   클릭 동선, 화면 보는 순서, 난이도 선택 전략 등 구체적인 행동 조언을 제시합니다.
5) 서비스 내부 설정(봇 난이도 분포, 시스템 정책 등)을 바꾸라는 제안은 하지 않고,
   "사용자가 이 환경에 어떻게 적응하면 좋을지"만 이야기합니다.
""".strip()


SYSTEM_PROMPT_TOAST = """
당신은 온라인 티켓팅 연습 서비스 'Tick-get'의 빠른 피드백 코치입니다.

- 한 번의 연습 결과(성공/실패, 속도, 미스 클릭, 순위 등)를 보고
  2~3문장 정도의 짧은 코멘트를 한국어 존댓말로 제공합니다.
- 사용자를 비난하거나 체념하게 만드는 표현은 피하고,
  "다음 번에 이렇게 해보면 좋겠다" 수준의 가벼운 제안을 곁들입니다.
- 시스템 설정(봇 난이도 분포, 서비스 구조 등)을 바꾸라는 말은 하지 않습니다.
""".strip()


# =========================
# 공통: JSON 직렬화 유틸
# =========================

def _to_plain(obj: Any) -> Any:
    """
    Pydantic 모델 / datetime / pandas.Timestamp 등을
    JSON으로 넣기 좋은 기본 타입(str, float, int, dict, list...)으로 변환.
    """
    # 1) Pydantic 모델이면 먼저 model_dump() 하고, 다시 재귀 태우기
    if hasattr(obj, "model_dump"):
        return _to_plain(obj.model_dump())

    # 2) datetime, pandas.Timestamp → ISO 문자열
    if isinstance(obj, (datetime, pd.Timestamp)):
        return obj.isoformat()

    # 3) dict → key/value 재귀 처리
    if isinstance(obj, dict):
        return {k: _to_plain(v) for k, v in obj.items()}

    # 4) list/tuple/set → 요소 재귀 처리
    if isinstance(obj, (list, tuple, set)):
        return [_to_plain(v) for v in obj]

    # 5) 나머지는 그대로
    return obj


# =========================
# 1) 마이페이지용 전체 분석 리포트 프롬프트
# =========================

def build_user_report_prompt(
    chart_data: Any,
    user_profile: Optional[UserProfile] = None,
    bot_params: Optional[Dict[str, Any]] = None,
) -> str:
    """
    마이페이지에서 사용하는 '전체 분석 리포트'용 user 프롬프트를 생성한다.

    - chart_data: calculate_chart_data에서 만든 ChartData 인스턴스(또는 dict)
    - user_profile: 선택. 있으면 닉네임/가입일 정보 등을 포함해줌.
    - bot_params: 현재 봇 파라미터(딜레이/분포) 정보. 참고용으로 넘김.
    """
    payload: Dict[str, Any] = {
        "chart_data": _to_plain(chart_data),
        "bot_params": _to_plain(bot_params) if bot_params is not None else None,
    }
    if user_profile is not None:
        payload["user_profile"] = user_profile.model_dump()
    else:
        payload["user_profile"] = None

    json_blob = json.dumps(payload, ensure_ascii=False, indent=2)

    prompt = f"""
    아래는 한 사용자의 티켓팅 연습 기록에 대한 통계 데이터입니다.

    이 데이터는 JSON 형식이며,
    - chart_data: 최근 일정 기간 동안의 성공률, 평균 선택 시간, 미스 클릭, 난이도별/레벨별 분포 등
    - user_profile: (선택) 사용자 기본 정보 (닉네임, 사용 일수 등)
    - bot_params: 현재 시스템에서 사용하는 봇 난이도/딜레이 설정 요약

    --- JSON 데이터 시작 ---
    ```json
    {json_blob}


    --- JSON 데이터 끝 ---

    위 데이터를 꼼꼼히 분석해서, 다음 구조로 한국어 리포트를 작성해 주세요.

    전체 요약 (2~3문장)

    최근 연습 성향을 한눈에 알 수 있게 요약합니다.

    예: 성공률이 어떤지, 속도와 미스 클릭이 어떤 패턴인지 등.

    강점 분석

    이 사용자가 잘하고 있는 부분을 2~3가지로 정리합니다.

    예: 특정 난이도에서의 안정된 성공률, 빠른 선택 속도, 미스 클릭 억제 등.

    보완이 필요한 부분

    데이터에서 드러나는 약점/변동성을 2~3가지로 정리합니다.

    단, 비난이 아닌 "이 부분을 조심하면 좋겠다"라는 톤으로 설명합니다.

    구체적인 개선 전략

    사용자가 다음 연습에서 바로 적용해볼 수 있는 행동 가이드를 3~5개 bullet로 작성합니다.

    예:

    "좌석 선택 전에 먼저 섹션을 훑어보고, 눈에 띄는 후보 2~3개만 집중하세요."

    "미스 클릭이 많다면, 클릭 속도를 조금만 늦추고 한 번 더 위치를 확인한 뒤 선택해 보세요."

    "초반에는 medium 난이도를 중심으로 연습하며, 성공률이 70% 이상 유지되면 hard 난이도를 섞어보세요."

    연습 난이도/패턴 제안

    beginner / expert / pro 봇의 비율과 현재 성과를 고려하여,
    앞으로 어떤 난이도 조합으로 연습하면 좋을지 제안합니다.

    단, 시스템의 기본 분포를 바꾸라고 제안하지 말고,
    "사용자가 easy/medium/hard 방을 어떻게 선택하면 좋을지"만 언급합니다.

    주의할 점:

    나이, 직업 등을 임의로 가정하지 않습니다.

    "초보자니까", "능숙하니까"와 같이 과도하게 단정하는 표현은 피하고,
    데이터에 기반한 관찰과 완곡한 표현을 사용합니다.

    리포트 전체는 존댓말로 작성합니다.
    """.strip()

    return prompt

# =========================
# 2) 한 경기 종료 후 토스트용 프롬프트
# =========================

def build_session_toast_prompt(
    difficulty: str,
    select_time: Optional[float],
    miss_count: Optional[int],
    success: bool,
    final_rank: Optional[int],
    user_count: Optional[int] = None,
    created_at: Optional[datetime] = None,
) -> str:
    import json
    from typing import Any, Dict, Optional

    rank_ratio: Optional[float] = None
    performance_band: Optional[str] = None

    if final_rank is not None and user_count and user_count > 0:
        rank_ratio = final_rank / user_count
        # 서버에서 구간을 확정해 버린다
        if rank_ratio <= 0.10:
            performance_band = "TOP_10"
        elif rank_ratio <= 0.50:
            performance_band = "TOP_50"
        elif rank_ratio <= 0.80:
            performance_band = "BOTTOM_50_80"
        else:
            performance_band = "BOTTOM_80_100"

    base: Dict[str, Any] = {
        "difficulty": difficulty,
        "success": success,
        "select_time": select_time,
        "miss_count": miss_count,
        "final_rank": final_rank,
        "user_count": user_count,
        "rank_ratio": rank_ratio,
        "performance_band": performance_band,
        "created_at": created_at.isoformat() if created_at else None,
    }

    json_blob = json.dumps(base, ensure_ascii=False, indent=2)

    prompt = f"""
아래는 사용자가 방금 끝낸 한 번의 티켓팅 연습 결과입니다.

--- 경기 결과 JSON ---

{json_blob}

--- 끝 ---

위 JSON에는 이번 경기의 난이도(difficulty), 성공 여부(success), 선택 시간(select_time),
미스 횟수(miss_count), 최종 순위(final_rank), 전체 참가 인원 수(user_count),
순위 비율(rank_ratio), 성과 구간(performance_band)이 담겨 있습니다.
- final_rank는 1위가 가장 좋은 순위이며, 숫자가 커질수록 순위가 내려갑니다.
- performance_band는 서버에서 미리 계산한 성과 구간으로, 다음 중 하나입니다:
  "TOP_10", "TOP_50", "BOTTOM_50_80", "BOTTOM_80_100".

이 데이터를 바탕으로, 사용자가 연습을 계속하고 싶어지도록
짧고 긍정적인 피드백 문단 하나를 만들어 주세요.

[작성 스타일]
- 한국어 존댓말을 사용해 주세요.
- 전체 길이는 2~3문장 정도로 가볍게 유지해 주세요.
- 톤은 부드럽고 응원하는 느낌으로, 너무 딱딱하지 않게 작성해 주세요.
- 다만 성과가 좋지 않은 구간에서는, 결과가 아쉽다는 점을 솔직하게 짚어 주셔도 됩니다.

[구성 가이드]
- 1문장: 이번 경기 결과를 간단히 요약해 주세요.
  - 성공/실패, 난이도, 속도, 순위를 자연스럽게 섞어 주시고,
  - final_rank와 user_count가 모두 있을 경우,
    반드시 한 번은 "전체 {user_count}명 중 {final_rank}위"처럼
    전체 인원 대비 순위를 문장에 포함해 주세요.
- 2문장: 잘한 점 또는 특히 괜찮았던 부분 한 가지를 칭찬해 주세요.
- 3문장(선택): 다음 연습에서 시도해 보면 좋을 간단한 팁을 한 줄 정도로 제안해 주세요.

[성과 구간별 톤 조절 (performance_band 기준)]
performance_band 값에 따라 말투와 강조점을 다음처럼 **확실하게** 다르게 해 주세요.

1) performance_band == "TOP_10":
- 매우 좋은 결과입니다. 상위권에서도 돋보이는 성과라는 인상을 분명하게 전달해 주세요.
- 예시 표현: "매우 뛰어난 결과", "상위권에서도 눈에 띄는 기록" 등
- 보완점은 있다면 아주 짧게, 가볍게만 언급해 주세요.

2) performance_band == "TOP_50":
- 충분히 잘한 결과임을 먼저 알려 주세요.
- 예시 표현: "상위권에 가까운 안정적인 기록", "경쟁력 있는 성과" 등
- "조금만 더 신경 쓰면 상위권도 노려볼 수 있다"는 식으로,
  도전 의욕이 생기도록 부드럽게 자극해 주세요.

3) performance_band == "BOTTOM_50_80":
- 결과가 다소 아쉬웠다는 점을 예의를 갖추어 솔직하게 짚어 주세요.
- 예시 표현: "아쉬운 편에 속하는 결과", "조금 더 개선할 여지가 있는 기록" 등
- 한 문장에서는 평소보다 조금 더 단호한 톤으로
  구체적인 개선 포인트(예: 반응 속도, 초반 클릭 집중도 등)를 짚어 주세요.
- 마지막에는 "다음 번에는 ~을 신경 쓰면 순위를 올릴 수 있다"는 식으로
  개선 방향과 희망적인 마무리를 함께 적어 주세요.

4) performance_band == "BOTTOM_80_100":
- 이번 결과가 **분명히 아쉬운 편**이라는 사실을 반드시 한 번은 직접적으로 표현해 주세요.
  - 예: "이번 경기는 전체 {user_count}명 중 {final_rank}위로, 결과가 많이 아쉬운 편입니다."
- 특히 final_rank == user_count (예: 전체 6명 중 6위)인 경우:
  - "상위권", "충분히 잘하셨습니다", "좋은 순위" 같은 표현을 사용하지 마세요.
  - 첫 문장은 반드시 "결과가 아쉬운 편입니다", "만족스럽지는 않은 결과입니다"와 같이
    이번 순위가 만족스럽지 않다는 점을 분명하게 드러내는 문장으로 시작해 주세요.
- 두 번째 문장에서는 그럼에도 불구하고 의미 있었던 부분
  (예: 미스가 적었다, HARD 난이도에 도전했다, 끝까지 포기하지 않았다 등)을 짚어 주세요.
- 세 번째 문장(또는 두 번째 문장의 뒤쪽)에서는
  "어떻게 연습하면 순위를 끌어올릴 수 있을지"에 대한 구체적인 행동 팁을 제시해 주세요.
- 이 구간에서는 약간의 쓴소리가 포함되어도 괜찮지만,
  마지막 문장은 반드시 "그래도 연습을 통해 충분히 나아질 수 있다"는
  격려와 희망의 메시지로 마무리해 주세요.

- performance_band가 None이거나 user_count가 없을 때에는,
  상대적인 순위 표현(예: "상위권", "중위권", "하위권")을 사용하지 말고,
  성공 여부와 절대적인 기록(속도, 미스 횟수 등)에만 기반하여 피드백을 작성해 주세요.

[사실 일관성 규칙]
- 순위와 인원 수에 맞지 않는 표현은 사용하지 마세요.
  - 예를 들어, 전체 6명 중 6위인 경우 "상위권", "충분히 좋은 순위"라고 말하면 안 됩니다.
- 항상 final_rank, user_count, success 등의 수치를 존중하여,
  사실과 모순되지 않는 범위 안에서만 긍정적인 표현을 사용해 주세요.

[주의 사항]
- 사용자를 비난하거나 낙담시키는 표현은 피하고,
  "이번 기록을 바탕으로 더 좋아질 수 있다"는 뉘앙스를 꼭 유지해 주세요.
- 서비스의 시스템 설정(봇 난이도 분포, 정책 등)을 바꾸라는 말은 쓰지 말고,
  오직 사용자의 플레이 방식과 연습 방법에 대한 조언만 포함해 주세요.
    """.strip()


    return prompt
