import { useEffect, useState } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import VolumeUpOutlinedIcon from "@mui/icons-material/VolumeUpOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

type Props = {
  open: boolean;
  onVerify: () => void;
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
  const [isFocused, setIsFocused] = useState<boolean>(false);

  useEffect(() => {
    setCode(generateCode(6));
  }, [seed]);

  if (!open) return null;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim().toUpperCase() === code) {
      onVerify();
    } else {
      setError("입력한 문자를 다시 확인해주세요");
      setInput("");
      setIsFocused(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative flex flex-col items-center gap-3">
        {/* Modal card */}
        <div className="w-[370px] max-w-[92vw] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.35)] border-4 border-[#5a5a5a] bg-white">
          <div className="p-5">
            <div className="flex items-center justify-center">
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#5a62d6] text-[#e9eaff] font-semibold px-3 py-1 text-xs">
                <CheckCircleOutlineIcon fontSize="small" /> 안심예매
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-center text-[#5a62d6]">
              문자를 입력해주세요
            </h2>
            <p className="mt-2 text-sm text-center text-gray-700 leading-5">
              부정예매방지를 위해 아래의 문자를 입력해주세요.
              <br />
              인증 후 좌석을 선택할 수 있습니다.
            </p>

            {/* Code box (temporary image) */}
            <div className="mt-4">
              <div className="relative w-[280px] h-[120px] mx-auto border-2 border-gray-300 bg-gray-100 p-3 flex items-center justify-center">
                <img
                  src="/tempcaptcha.jpg"
                  alt="보안문자"
                  className="block mx-auto w-[210px] h-auto select-none"
                />
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-center">
                  <button
                    type="button"
                    className="h-[30px] w-[30px] rounded-full bg-black text-white opacity-60 hover:cursor-pointer"
                    onClick={() => setSeed((s) => s + 1)}
                    aria-label="새로고침"
                  >
                    <RefreshIcon fontSize="small" />
                  </button>
                  <button
                    type="button"
                    className="h-[30px] w-[30px] rounded-full bg-black text-white opacity-60 hover:cursor-pointer"
                    aria-label="음성 안내"
                  >
                    <VolumeUpOutlinedIcon fontSize="small" />
                  </button>
                </div>
              </div>

              <form onSubmit={submit} className="mt-3">
                <div
                  className={`relative mx-auto w-[280px] h-12 border ${
                    error ? "border-red-500" : "border-[#d0d0d0]"
                  } bg-white rounded-none`}
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    className={`absolute inset-0 w-full h-full px-3 outline-none bg-transparent rounded-none ${
                      isFocused || input ? "pt-3" : ""
                    }`}
                  />
                  <span
                    className={`pointer-events-none absolute transition-all duration-150 text-[12px] ${
                      isFocused || input
                        ? "left-3 top-1 text-[#999999]"
                        : "left-3 top-1/2 -translate-y-1/2 text-[#999999]"
                    }`}
                  >
                    문자를 입력해주세요
                  </span>
                </div>
                <div className="mt-7 mb-4 mx-auto w-[280px] relative">
                  {error && (
                    <div className="absolute -top-6 left-0 text-[12px] text-red-600">
                      {error}
                    </div>
                  )}
                  <div className="flex gap-1 justify-between">
                    <button
                      type="button"
                      onClick={onReselect}
                      className="w-[138px] h-10 bg-[#6A6A6A] text-white text-sm hover:cursor-pointer"
                    >
                      날짜 다시 선택
                    </button>
                    <button
                      type="submit"
                      className="w-[138px] h-10 bg-[#393F47] text-white text-sm hover:cursor-pointer"
                    >
                      입력완료
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Footer helper text */}
        <div className="text-center text-[12px] text-white">
          <span>좌석 먼저 보고 입력하려면, </span>
          <button
            onClick={onReselect}
            className="underline hover:cursor-pointer"
          >
            잠깐 접어두기↘
          </button>
        </div>
      </div>
    </div>
  );
}
