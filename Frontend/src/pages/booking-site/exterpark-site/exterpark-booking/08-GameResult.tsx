import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  readMetricsWithFallback,
  formatSecondsHuman,
} from "../../../../shared/utils/reserveMetrics";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AdsClickIcon from "@mui/icons-material/AdsClick";
import CloseIcon from "@mui/icons-material/Close";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import { paths } from "../../../../app/routes/paths";
import { finalizeTotalNow } from "../../../../shared/utils/reserveMetrics";
import { useAuthStore } from "@features/auth/store";
import { useRoomStore } from "@features/room/store";
import { exitRoom } from "@features/room/api";
import {
  getRoom,
  getSessionToastLLM,
  buildSeatMetricsPayload,
} from "@features/booking-site/api";
import GameAnalysisLoader from "./_components/GameAnalysisLoader";

export default function GameResultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUserId = useAuthStore((s) => s.userId);
  const currentUserNickname = useAuthStore((s) => s.nickname);
  const GAME_RESULT_BANNER_HIDE_UNTIL = "gameResultBannerHideUntil";
  const [showBanner, setShowBanner] = useState<boolean>(() => {
    try {
      const untilRaw = localStorage.getItem(GAME_RESULT_BANNER_HIDE_UNTIL);
      const until = untilRaw ? parseInt(untilRaw, 10) : 0;
      return !(until && Date.now() < until);
    } catch {
      return true;
    }
  });
  const [isExiting, setIsExiting] = useState(false);
  const handleBannerClose = (dontShow: boolean) => {
    try {
      if (dontShow) {
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        localStorage.setItem(
          GAME_RESULT_BANNER_HIDE_UNTIL,
          String(Date.now() + threeDaysMs)
        );
      }
    } finally {
      setShowBanner(false);
    }
  };
  const handleExitRoom = async () => {
    const qsRoomId = searchParams.get("roomId");
    const storeRoomId = useRoomStore.getState().roomInfo?.roomId ?? undefined;
    const targetRoomId =
      qsRoomId && !Number.isNaN(Number(qsRoomId))
        ? Number(qsRoomId)
        : storeRoomId;

    if (!targetRoomId) {
      // 방 ID를 알 수 없으면 홈으로 이동
      navigate(paths.home, { replace: true });
      return;
    }
    if (!currentUserId || !currentUserNickname) {
      navigate(paths.home, { replace: true });
      return;
    }

    setIsExiting(true);
    try {
      await exitRoom(targetRoomId, {
        userId: currentUserId,
        userName: currentUserNickname,
      });
      useRoomStore.getState().clearRoomInfo();
      navigate(paths.home, { replace: true });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("방 나가기 실패:", error);
      }
      navigate(paths.home, { replace: true });
    } finally {
      setIsExiting(false);
    }
  };

  const {
    rtSec,
    nrClicks,
    captchaSec,
    capToCompleteSec,
    capBackspaces,
    capWrong,
    seatTakenCount,
    seatClickMiss,
  } = useMemo(() => readMetricsWithFallback(searchParams), [searchParams]);

  const totalSec = useMemo(() => {
    const seatSec = capToCompleteSec ?? 0;
    return rtSec + captchaSec + seatSec;
  }, [rtSec, captchaSec, capToCompleteSec]);

  const fmt = formatSecondsHuman;

  // 실패 케이스 여부 (MATCH_ENDED 등으로 조기 종료된 경우)
  const isFailed = useMemo(
    () => searchParams.get("failed") === "true",
    [searchParams]
  );

  // 실패 케이스일 때, SeatConfirmRequest/SeatStatsFailed와 동일한 메트릭을 재구성
  const failedSeatMetrics = useMemo(() => {
    if (!isFailed) return null;
    if (!currentUserId) return null;
    try {
      return buildSeatMetricsPayload(currentUserId);
    } catch {
      return null;
    }
  }, [isFailed, currentUserId]);

  // userRank를 URL 파라미터 또는 sessionStorage에서 가져오기
  const userRank = useMemo(() => {
    if (isFailed) return null;
    const userRankParam = searchParams.get("userRank");
    const userRankStorage = sessionStorage.getItem("reserve.userRank");
    return userRankParam || userRankStorage || null;
  }, [searchParams, isFailed]);

  // AI 분석 메시지 상태
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  useEffect(() => {
    // 2분 뒤 자동 방 나가기 처리
    const id = setTimeout(
      () => {
        // 수동 "방 나가기" 버튼과 동일한 로직 재사용
        // (서버에 exitRoom 호출 후 홈/방 목록으로 이동)
        void handleExitRoom();
      },
      2 * 60 * 1000
    );

    return () => clearTimeout(id);
    // handleExitRoom은 navigate, searchParams 등을 캡처하지만
    // 결과 페이지 라이프사이클 동안만 유지되므로 ESLint deps는 생략
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 총 소요 시간 최종 마킹
    finalizeTotalNow();
  }, []);

  // 실패 API 로그 확인 (sessionStorage에서 읽어서 콘솔에 출력)
  useEffect(() => {
    try {
      const logsKey = "reserve.seatStatsFailedLogs";
      const logsJson = sessionStorage.getItem(logsKey);
      if (logsJson) {
        const logs = JSON.parse(logsJson);
        if (Array.isArray(logs) && logs.length > 0) {
          console.log(
            "[seat-stats-failed] 저장된 로그 (결과 페이지에서 확인):",
            logs
          );
        }
      }
    } catch (e) {
      // 로그 읽기 실패는 무시
    }
  }, []);

  // AI 분석 메시지 가져오기
  useEffect(() => {
    let cancelled = false;
    setIsLoadingAnalysis(true);

    (async () => {
      try {
        // roomId 가져오기
        const qsRoomId = searchParams.get("roomId");
        const storeRoomId =
          useRoomStore.getState().roomInfo?.roomId ?? undefined;
        const targetRoomId =
          qsRoomId && !Number.isNaN(Number(qsRoomId))
            ? Number(qsRoomId)
            : storeRoomId;

        if (!targetRoomId) {
          if (!cancelled) {
            setIsLoadingAnalysis(false);
          }
          return;
        }

        // 방 상세 정보 가져오기 (difficulty를 위해)
        const roomDetail = await getRoom(targetRoomId);
        const difficulty = roomDetail.difficulty?.toLowerCase() || "medium";

        // API 요청 데이터 구성
        const payload = {
          difficulty,
          select_time: capToCompleteSec ?? undefined,
          miss_count: seatClickMiss > 0 ? seatClickMiss : undefined,
          success: !isFailed, // 실패 케이스에서는 false로 전송
          final_rank: userRank ? Number(userRank) : undefined,
          created_at: new Date().toISOString(),
        };

        // API 호출
        const response = await getSessionToastLLM(payload);
        if (!cancelled) {
          setAnalysisMessage(response.text);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("AI 분석 메시지 가져오기 실패:", error);
        }
        if (!cancelled) {
          setAnalysisMessage(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAnalysis(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, capToCompleteSec, seatClickMiss, userRank, isFailed]);

  return (
    <>
      {showBanner && <TopBanner onClose={handleBannerClose} />}
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-6">
        {/* 타이틀 + 예매확인 버튼 */}
        <div className="mt-6 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-gray-900">경기 결과</h1>
        </div>

        {/* 성과 요약 */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg bg-[#6e8ee3] text-white text-center py-4 text-3xl font-extrabold">
            {isFailed
              ? "등수 없음"
              : userRank
                ? `${userRank}등`
                : "등수 측정중"}
          </div>
          <div className="rounded-lg bg-[#6e8ee3] text-white text-center py-4 text-3xl font-extrabold">
            {isFailed ? "FAIL" : fmt(totalSec)}
          </div>
        </div>

        {/* 카드 3개 */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <ResultCard
            title="예매 버튼 클릭"
            items={[
              {
                label: "반응 속도",
                value:
                  isFailed && failedSeatMetrics?.dateSelectTime === -1
                    ? "x"
                    : `${rtSec.toFixed(2)} 초`,
                icon: (
                  <AccessTimeIcon fontSize="small" className="text-gray-500" />
                ),
              },
              {
                label: "클릭 실수",
                value:
                  isFailed && failedSeatMetrics?.dateMissCount === -1
                    ? "x"
                    : `${nrClicks}회`,
                icon: (
                  <AdsClickIcon fontSize="small" className="text-gray-500" />
                ),
              },
            ]}
          />
          <ResultCard
            title="보안 문자"
            items={[
              {
                label: "소요 시간",
                value:
                  isFailed && failedSeatMetrics?.seccodeSelectTime === -1
                    ? "x"
                    : `${captchaSec.toFixed(2)} 초`,
                icon: (
                  <AccessTimeIcon fontSize="small" className="text-gray-500" />
                ),
              },
              {
                label: "백스페이스",
                value:
                  isFailed && failedSeatMetrics?.seccodeBackspaceCount === -1
                    ? "x"
                    : `${capBackspaces ?? 0}회`,
                icon: <CloseIcon fontSize="small" className="text-gray-500" />,
              },
              {
                label: "틀린 횟수",
                value:
                  isFailed && failedSeatMetrics?.seccodeTryCount === -1
                    ? "x"
                    : `${capWrong ?? 0}회`,
                icon: <CloseIcon fontSize="small" className="text-gray-500" />,
              },
            ]}
          />
          <ResultCard
            title="좌석 선택"
            items={[
              {
                label: "소요 시간",
                value:
                  isFailed && failedSeatMetrics?.seatSelectTime === -1
                    ? "x"
                    : `${(capToCompleteSec ?? 0).toFixed(2)} 초`,
                icon: (
                  <AccessTimeIcon fontSize="small" className="text-gray-500" />
                ),
              },
              // {
              //   label: "클릭 실수",
              //   value: `${seatClickMiss}회`,
              //   icon: (
              //     <AdsClickIcon fontSize="small" className="text-gray-500" />
              //   ),
              // },
              {
                label: "이선좌",
                value:
                  isFailed && failedSeatMetrics?.seatSelectTryCount === -1
                    ? "x"
                    : `${seatTakenCount}회`,
                icon: (
                  <EventSeatIcon fontSize="small" className="text-gray-500" />
                ),
              },
            ]}
          />
        </div>

        {/* AI 분석 메시지 (세 개 섹션 밑, 방 나가기 버튼 위) */}
        <div className="mt-6">
          {isLoadingAnalysis ? (
            <GameAnalysisLoader />
          ) : analysisMessage ? (
            <div
              className="rounded-lg bg-white p-4 border border-gray-200"
              style={{ boxShadow: "0 1px 3px 0 rgba(147, 197, 253, 0.3)" }}
            >
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {analysisMessage}
              </div>
            </div>
          ) : null}
        </div>

        {/* 하단 버튼 */}
        <div className="mt-8 flex items-center justify-center gap-6">
          {/* <button
          type="button"
          onClick={() => navigate(paths.iTicket)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#e9efff] text-[#143eab] px-6 py-4 text-lg font-extrabold hover:bg-[#dbe6ff]"
        >
          <RestartAltIcon /> 다시하기
        </button> */}
          <button
            type="button"
            onClick={handleExitRoom}
            disabled={isExiting}
            className="inline-flex items-center gap-2 rounded-xl bg-[#5b7ae7] text-white px-8 py-4 text-lg font-extrabold hover:bg-[#4d6ad6] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MeetingRoomOutlinedIcon />방 나가기
          </button>
        </div>
      </div>
    </>
  );
}

function TopBanner({ onClose }: { onClose: (dontShow: boolean) => void }) {
  return (
    <div className="mt-2 bg-gradient-to-r from-[#104BB7] to-[#072151] text-white">
      <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-3 text-sm">
        <p className="absolute inset-0 flex items-center justify-center font-semibold text-center pointer-events-none">
          시간이 지나면 방에서 자동으로 나가게 됩니다.
        </p>
        <div className="flex items-center gap-4 justify-end">
          <button
            aria-label="close-banner"
            onClick={() => onClose(false)}
            className="text-xl leading-none"
            type="button"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string; icon?: React.ReactNode }[];
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-[#eef2ff] px-4 py-3 font-semibold text-[#2f56a5] border-b border-gray-200">
        {title}
      </div>
      <div className="p-5 space-y-3 text-gray-800">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              {it.icon}
              <span>{it.label} :</span>
            </span>
            <span className="font-extrabold">{it.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
