import { useEffect, useMemo, useState } from "react";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import { useNavigate, useSearchParams } from "react-router-dom";
import { paths } from "../../../../app/routes/paths";
import Viewport from "./_components/Viewport";
import {
  health as bookingHealth,
  requestCaptchaImage,
  enqueueTicketingQueue,
} from "@features/booking-site/api";

export default function BookingWaitingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stage, setStage] = useState<"loading" | "queue" | "captcha">(
    "loading"
  );
  const [rank, setRank] = useState<number>(60);
  const totalQueue = 73;
  const PROGRESS_STEPS = useMemo(
    () => [80, 70, 60, 50, 40, 30, 20, 10] as const,
    []
  );
  const [progress, setProgress] = useState<number>(PROGRESS_STEPS[0]);
  const START_RANK = 11080;
  const END_RANK = 955;

  useEffect(() => {
    const timer = setTimeout(() => setStage("queue"), 1200);
    return () => clearTimeout(timer);
  }, []);

  // booking-site API 연결: 서버 상태/캡차 이미지 사전 확인
  useEffect(() => {
    (async () => {
      try {
        const res = await bookingHealth();
        console.log("[booking-site][health] 성공:", res);
      } catch (error) {
        console.error("[booking-site][health] 실패:", error);
      }
      try {
        const captcha = await requestCaptchaImage();
        console.log("[booking-site][captcha.request] 성공:", captcha);
      } catch (error) {
        console.error("[booking-site][captcha.request] 실패:", error);
      }
    })();
  }, []);

  useEffect(() => {
    if (stage !== "queue") return;
    setRank(START_RANK);
    setProgress(PROGRESS_STEPS[0]);
    // 예시: 진행도 80→70→...→10으로 감소
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      stepIndex += 1;
      if (stepIndex < PROGRESS_STEPS.length) {
        setProgress(PROGRESS_STEPS[stepIndex]);
        const t = stepIndex / (PROGRESS_STEPS.length - 1);
        const nextRank = Math.round(START_RANK - (START_RANK - END_RANK) * t);
        setRank(nextRank);
      } else {
        clearInterval(progressInterval);
        const rtSec = searchParams.get("rtSec") ?? "0";
        const nrClicks = searchParams.get("nrClicks") ?? "0";
        const nextUrl = `${paths.booking.selectSeat}?rtSec=${encodeURIComponent(rtSec)}&nrClicks=${encodeURIComponent(nrClicks)}`;
        navigate(nextUrl, { replace: true });
      }
    }, 350);
    return () => {
      clearInterval(progressInterval);
    };
  }, [stage, PROGRESS_STEPS, navigate, searchParams]);

  // 대기열 진입 시 큐 등록 API 호출 (matchId가 있을 때만)
  useEffect(() => {
    if (stage !== "queue") return;
    const matchId = searchParams.get("matchId");
    const clickMiss = Number(searchParams.get("nrClicks")) || 0;
    const duration = Number(searchParams.get("rtSec")) || 0;
    if (!matchId) {
      console.log("[booking-site][queue.enqueue] matchId가 없어 생략합니다.", {
        clickMiss,
        duration,
      });
      return;
    }
    (async () => {
      try {
        console.log("[booking-site][queue.enqueue] 요청 시작:", {
          matchId,
          clickMiss,
          duration,
        });
        const res = await enqueueTicketingQueue(matchId, {
          clickMiss,
          duration,
        });
        console.log("[booking-site][queue.enqueue] 성공:", res);
      } catch (error) {
        console.error("[booking-site][queue.enqueue] 실패:", error);
      }
    })();
  }, [stage, searchParams]);

  // 캡차는 좌석 선택 페이지의 모달로 이동

  if (stage === "loading") {
    return (
      <Viewport>
        <div className="w-full h-full flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="mx-auto mb-8 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-gray-500" />
            <div className="text-xl font-extrabold text-gray-900 tracking-tight">
              예매 화면을 불러오는 중입니다.
            </div>
            <div className="mt-2 text-lg text-blue-600 font-extrabold">
              조금만 기다려주세요.
            </div>
          </div>
        </div>
      </Viewport>
    );
  }

  // queue stage
  if (stage === "queue") {
    const percent = progress; // 남은 비율(%)
    const widthPercent = Math.max(0, Math.min(100, 100 - percent)); // 좌→우로 증가
    const isImminent = percent <= 20; // 진행도가 많이 줄어들면(20% 이하) 임박 상태

    return (
      <Viewport>
        <div className="w-full h-full bg-white">
          <div className="pt-6 max-w-lg mx-auto p-6">
            <h1 className="text-2xl font-extrabold text-gray-900">
              {isImminent
                ? "곧 고객님의 순서가 다가옵니다."
                : "접속 인원이 많아 대기 중입니다."}
            </h1>
            <div
              className={`text-2xl mt-1 font-extrabold ${isImminent ? "text-red-600" : "text-blue-600"}`}
            >
              {isImminent ? "예매를 준비해주세요." : "조금만 기다려주세요."}
            </div>

            <div className="mt-2 text-gray-700">티켓을 겟하다, Tickget!</div>

            <div className="mt-4 rounded-xl border-[#e3e3e3] border shadow-lg bg-white p-6">
              <div className="text-center text-md text-black font-bold mb-2">
                나의 대기순서
              </div>
              <div className="text-center text-6xl font-extrabold text-gray-900">
                {rank}
              </div>

              <div className="mt-2">
                <div className="relative h-6 rounded-full bg-gray-100">
                  <div
                    className={`absolute left-0 top-0 h-6 rounded-full ${
                      isImminent ? "bg-red-500" : "bg-blue-600"
                    }`}
                    style={{ width: `${widthPercent}%` }}
                  />
                  <ConfirmationNumberOutlinedIcon
                    fontSize="small"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 rotate-[-10deg]"
                  />
                </div>
                <div className="mt-4 h-px bg-gray-100" />
                <div className="mt-3 font-regular text-md text-gray-600 flex items-center justify-between">
                  <span>현재 대기인원</span>
                  <span className="text-black font-extrabold">
                    {totalQueue}명
                  </span>
                </div>
              </div>
            </div>
            <ul className="mt-6 text-sm text-gray-400 list-disc pl-5 space-y-1">
              <li>잠시만 기다려주시면, 예매하기 페이지로 연결됩니다.</li>
              <li>
                새로고침하거나 재접속 하시면 대기순서가 초기화되어 대기시간이 더
                길어집니다.
              </li>
            </ul>
          </div>
        </div>
      </Viewport>
    );
  }

  // no further stages; navigation happens after queue
  return null;
}
