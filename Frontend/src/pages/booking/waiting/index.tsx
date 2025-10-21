import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { paths } from "../../../app/routes/paths";

export default function BookingWaitingPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<"loading" | "queue" | "captcha">(
    "loading"
  );
  const [rank, setRank] = useState<number>(60);
  const totalQueue = 73;

  useEffect(() => {
    const timer = setTimeout(() => setStage("queue"), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (stage !== "queue") return;
    setRank(60);
    const interval = setInterval(() => {
      setRank((prev) => (prev > 52 ? prev - 1 : prev));
    }, 120);
    const toCaptcha = setTimeout(() => {
      clearInterval(interval);
      setStage("captcha");
    }, 2200);
    return () => {
      clearInterval(interval);
      clearTimeout(toCaptcha);
    };
  }, [stage]);

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
          <div className="mx-auto mb-8 h-12 w-12 md:h-14 md:w-14 animate-spin rounded-full border-4 border-gray-200 border-t-gray-500" />
          <div className="text-xl md:text-2xl font-extrabold text-gray-900 tracking-tight">
            예매 화면을 불러오는 중입니다.
          </div>
          <div className="text-xl md:text-2xl text-blue-600 font-bold">
            조금만 기다려주세요.
          </div>
        </div>
      </div>
    );
  }

  // queue stage
  if (stage === "queue") {
    const percent = Math.max(
      0,
      Math.min(100, ((totalQueue - rank) / totalQueue) * 100)
    );

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto p-6">
          <h1 className="text-2xl font-bold text-gray-900">
            접속 인원이 많아 대기 중입니다.
          </h1>
          <div className="mt-2 text-blue-600 font-semibold">
            조금만 기다려주세요.
          </div>

          <div className="mt-6 text-gray-700">
            YB REMASTERED 3.0 : Transcendent - 대구
          </div>

          <div className="mt-4 rounded-xl border bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-600 mb-2">나의 대기순서</div>
            <div className="text-6xl font-extrabold text-gray-900">{rank}</div>

            <div className="mt-6">
              <div className="relative h-4 rounded-full bg-gray-100">
                <div
                  className="absolute left-0 top-0 h-4 rounded-full bg-blue-600"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-gray-600 flex items-center justify-between">
                <span>현재 대기인원</span>
                <span className="font-semibold">{totalQueue}명</span>
              </div>
            </div>

            <ul className="mt-6 text-xs text-gray-500 list-disc pl-5 space-y-1">
              <li>잠시만 기다려주시면, 예매하기 페이지로 연결됩니다.</li>
              <li>
                새로고침하거나 재접속 하시면 대기순서가 초기화되어 대기시간이 더
                길어질 수 있습니다.
              </li>
            </ul>
          </div>
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
