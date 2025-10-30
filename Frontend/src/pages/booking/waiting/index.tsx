import { useEffect, useMemo, useState } from "react";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import { useNavigate, useSearchParams } from "react-router-dom";
import { paths } from "../../../app/routes/paths";

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
    return () => clearInterval(timer as unknown as number);
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
        setStage("captcha");
      }
    }, 350);
    return () => {
      clearInterval(progressInterval);
    };
  }, [stage, PROGRESS_STEPS]);

  useEffect(() => {
    if (stage !== "captcha") return;
    const rtSec = searchParams.get("rtSec");
    const nrClicks = searchParams.get("nrClicks");
    console.log("[ReserveTiming] Arrived at captcha stage", {
      reactionSec: rtSec ? Number(rtSec) : null,
      nonReserveClickCount: nrClicks ? Number(nrClicks) : null,
    });
  }, [stage, searchParams]);

  // 캡차 단계에서만 사용하지만 훅 호출 순서를 보장하기 위해 상단에서 선언
  const code = useMemo(() => generateCode(6), []);
  const [input, setInput] = useState<string>("");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 간단 매칭 후 1단계 화면으로 이동 (실제 검증은 서버 검증 필요)
    navigate(paths.booking.selectSchedule, { replace: true });
  };

  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto mb-12 h-12 w-12 md:h-12 md:w-12 animate-spin rounded-full border-4 border-gray-200 border-t-gray-500" />
          <div className="text-xl md:text-2xl font-extrabold text-gray-900 tracking-tight">
            예매 화면을 불러오는 중입니다.
          </div>
          <div className="mt-2 text-lg md:text-2xl text-blue-600 font-extrabold">
            조금만 기다려주세요.
          </div>
        </div>
      </div>
    );
  }

  // queue stage
  if (stage === "queue") {
    const percent = progress; // 남은 비율(%)
    const widthPercent = Math.max(0, Math.min(100, 100 - percent)); // 좌→우로 증가
    const isImminent = percent <= 20; // 진행도가 많이 줄어들면(20% 이하) 임박 상태

    return (
      <div className="min-h-screen bg-white">
        <div className="mt-8 max-w-lg mx-auto p-6">
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
    );
  }

  // captcha stage
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-lg border">
        <div className="p-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center rounded-full bg-indigo-50 text-indigo-600 font-semibold px-3 py-1 text-xs">
              안심예매
            </div>
            <h2 className="mt-3 text-2xl font-extrabold text-gray-900">
              문자를 입력해주세요
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              부정예매방지를 위해 아래의 문자를 입력해주세요. 인증 후 좌석을
              선택할 수 있습니다.
            </p>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-20 rounded-md bg-[#1e3a8a] text-white flex items-center justify-center text-2xl tracking-widest select-none">
                {code}
              </div>
              <button
                type="button"
                className="h-10 w-10 rounded-md border text-gray-600 hover:bg-gray-50"
                aria-label="새로고침"
              >
                ↻
              </button>
            </div>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="문자를 입력해주세요"
                className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-md border px-3 py-2 hover:bg-gray-50"
                >
                  날짜 다시 선택
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-md bg-gray-900 text-white px-3 py-2 hover:bg-black"
                >
                  입력완료
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function generateCode(len: number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
