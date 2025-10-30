import { useEffect, useState } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import VolumeUpOutlinedIcon from "@mui/icons-material/VolumeUpOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

type Props = {
  open: boolean;
  /**
   * Called when captcha is successfully verified.
   * durationMs: elapsed milliseconds from modal open to success.
   */
  onVerify: (
    durationMs: number,
    metrics: { backspaceCount: number; wrongAttempts: number }
  ) => void;
  onReselect: () => void;
};

function generateCode(len: number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function CaptchaModal({ open, onVerify, onReselect }: Props) {
  const [seed, setSeed] = useState<number>(0);
  const [code, setCode] = useState<string>(() => generateCode(6));
  const [input, setInput] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [startMs, setStartMs] = useState<number | null>(null);
  const [backspaceCount, setBackspaceCount] = useState<number>(0);
  const [wrongAttempts, setWrongAttempts] = useState<number>(0);

  useEffect(() => {
    setCode(generateCode(6));
  }, [seed]);

  // mark start time when modal opens
  useEffect(() => {
    if (open) {
      setStartMs(
        typeof performance !== "undefined" ? performance.now() : Date.now()
      );
      setInput("");
      setError("");
      setSeed((s) => s + 1); // refresh code on each open
      setBackspaceCount(0);
      setWrongAttempts(0);
    }
  }, [open]);

  if (!open) return null;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim().toUpperCase() === code) {
      const endMs =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const duration = startMs != null ? Math.max(0, endMs - startMs) : 0;
      onVerify(duration, { backspaceCount, wrongAttempts });
    } else {
      setError("문자가 일치하지 않습니다.");
      setWrongAttempts((n) => n + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative flex flex-col items-center gap-3">
        {/* Modal card */}
        <div className="w-[420px] max-w-[92vw] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.35)] border-4 border-[#5a5a5a] bg-[#f6f6f6]">
          <div className="p-5">
            <div className="flex items-center justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#5a62d6] text-[#e9eaff] font-semibold px-3 py-1 text-xs">
                <CheckCircleOutlineIcon fontSize="small" /> 안심예매
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-extrabold text-center text-[#5a62d6]">
              문자를 입력해주세요
            </h2>
            <p className="mt-2 text-sm text-center text-gray-700 leading-5">
              부정예매방지를 위해 아래의 문자를 입력해주세요.
              <br />
              인증 후 좌석을 선택할 수 있습니다.
            </p>

            {/* Code box */}
            <div className="mt-4">
              <div className="relative rounded-md border-2 border-gray-300 bg-gray-100 p-3">
                <div className="relative rounded-sm shadow-inner bg-[#1e293b]/90">
                  <div className="px-6 py-4 font-extrabold tracking-[0.5em] text-2xl text-[#a8ff60] select-none">
                    {code}
                  </div>
                  <div className="absolute right-[-44px] top-1/2 -translate-y-1/2 flex flex-col gap-2">
                    <button
                      type="button"
                      className="h-9 w-9 rounded-full bg-[#efefef] border border-[#d0d0d0] text-gray-600 shadow hover:bg-white"
                      onClick={() => setSeed((s) => s + 1)}
                      aria-label="새로고침"
                    >
                      <RefreshIcon fontSize="small" />
                    </button>
                    <button
                      type="button"
                      className="h-9 w-9 rounded-full bg-[#efefef] border border-[#d0d0d0] text-gray-600 shadow hover:bg-white"
                      aria-label="음성 안내"
                    >
                      <VolumeUpOutlinedIcon fontSize="small" />
                    </button>
                  </div>
                </div>
              </div>

              <form onSubmit={submit} className="mt-3 space-y-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace") setBackspaceCount((n) => n + 1);
                  }}
                  placeholder="문자를 입력해주세요"
                  className="w-full h-11 rounded-md border border-[#d0d0d0] bg-white px-3 focus:outline-none focus:ring-2 focus:ring-[#5a62d6]"
                />
                {error && <div className="text-sm text-red-600">{error}</div>}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onReselect}
                    className="flex-1 h-11 bg-gray-500 text-white font-semibold"
                  >
                    날짜 다시 선택
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-11 bg-gray-700 text-white font-semibold"
                  >
                    입력완료
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Footer helper text */}
        <div className="text-center text-[12px] text-white">
          <span>좌석 먼저 보고 입력하려면, </span>
          <button onClick={onReselect} className="underline font-bold">
            잠깐 접어두기
          </button>
        </div>
      </div>
    </div>
  );
}
