import { useEffect, useRef, useState } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import VolumeUpOutlinedIcon from "@mui/icons-material/VolumeUpOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import {
  requestCaptchaImage,
  validateCaptcha,
} from "@features/booking-site/api";

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
  /**
   * Called when user wants to temporarily hide captcha (e.g. "접어두기").
   * If not provided, falls back to onReselect for backward compatibility.
   */
  onFold?: () => void;
};

export default function CaptchaModal({
  open,
  onVerify,
  onReselect,
  onFold,
}: Props) {
  const [seed, setSeed] = useState<number>(0);
  const [input, setInput] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [backspaceCount, setBackspaceCount] = useState<number>(0);
  const [wrongAttempts, setWrongAttempts] = useState<number>(0);
  const [captchaImg, setCaptchaImg] = useState<string>("");
  const [captchaId, setCaptchaId] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastBackspaceAtRef = useRef<number>(0);

  // bump seed to refresh image when needed

  // mark start time when modal opens
  useEffect(() => {
    if (open) {
      setStartMs(
        typeof performance !== "undefined" ? performance.now() : Date.now()
      );
      setInput("");
      setError("");
      setSeed((s) => s + 1); // refresh image on each open
      setBackspaceCount(0);
      setWrongAttempts(0);
      // 초기화: HUD 실시간 표시에 대비하여 세션 스토리지 값도 0으로 리셋
      try {
        sessionStorage.setItem("reserve.capBackspaces", "0");
        sessionStorage.setItem("reserve.capWrong", "0");
      } catch (error) {
        // 세션 스토리지 사용 불가 시 무시 (프라이빗 모드 등)
        if (import.meta.env.DEV) {
          console.warn("[CaptchaModal] 세션 스토리지 초기화 실패", error);
        }
      }
      // 입력창 자동 포커스
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [open]);

  // fetch captcha image when modal opens or seed changes
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const data = await requestCaptchaImage();
        if (alive) {
          setCaptchaImg(data.image);
          setCaptchaId(data.id);
         
        }
      } catch {
        
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, seed]);

  if (!open) return null;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim().length > 0) {
      try {
        if (!captchaId) {
          setError("보안문자를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
          return;
        }
        const result = await validateCaptcha({
          captchaId,
          input: input.trim(),
        });
        
        if (result.status === 200) {
          const endMs =
            typeof performance !== "undefined" ? performance.now() : Date.now();
          const duration = startMs != null ? Math.max(0, endMs - startMs) : 0;
          onVerify(duration, { backspaceCount, wrongAttempts });
          return;
        }
        if (result.status === 401) {
          setError("입력한 문자를 다시 확인해주세요");
          setInput("");
          setIsFocused(false);
          setWrongAttempts((w) => {
            const next = w + 1;
            try {
              sessionStorage.setItem("reserve.capWrong", String(next));
            } catch (error) {
              if (import.meta.env.DEV) {
                console.warn(
                  "[CaptchaModal] reserve.capWrong 저장 실패 (401 응답)",
                  error
                );
              }
            }
            return next;
          });
          return;
        }
        if (result.status === 400) {
          // 답변 시간 초과 → 새 캡챠로 새로고침
          setSeed((s) => s + 1);
          setInput("");
          setIsFocused(false);
          return;
        }
        if (result.status === 404) {
          // 캡챠가 만료/미존재 → 새 캡챠로 새로고침
          setSeed((s) => s + 1);
          setInput("");
          setIsFocused(false);
          return;
        }
        // 기타 상태 코드: 일반 에러 처리
        setError("입력한 문자를 다시 확인해주세요");
        setInput("");
        setIsFocused(false);
        setWrongAttempts((w) => {
          const next = w + 1;
          try {
            sessionStorage.setItem("reserve.capWrong", String(next));
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn(
                "[CaptchaModal] reserve.capWrong 저장 실패 (기타 응답)",
                error
              );
            }
          }
          return next;
        });
      } catch (error) {
        setError("입력한 문자를 다시 확인해주세요");
        setInput("");
        setIsFocused(false);
        setWrongAttempts((w) => {
          const next = w + 1;
          try {
            sessionStorage.setItem("reserve.capWrong", String(next));
          } catch (e) {
            if (import.meta.env.DEV) {
              console.warn(
                "[CaptchaModal] reserve.capWrong 저장 실패 (예외)",
                e
              );
            }
          }
          return next;
        });
        // 잘못된 경우 새 캡챠 요청
        setSeed((s) => s + 1);
        if (import.meta.env.DEV) {
          console.error("[CaptchaModal] 캡챠 검증 중 예외 발생", error);
        }
      }
    } else {
      setError("입력한 문자를 다시 확인해주세요");
      setInput("");
      setIsFocused(false);
      setWrongAttempts((w) => {
        const next = w + 1;
        try {
          sessionStorage.setItem("reserve.capWrong", String(next));
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn(
              "[CaptchaModal] reserve.capWrong 저장 실패 (빈 입력)",
              error
            );
          }
        }
        return next;
      });
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
                  src={captchaImg || `/tempcaptcha.jpg?${seed}`}
                  alt="보안문자"
                  className="block mx-auto w-[210px] h-auto select-none"
                />
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-center">
                  <button
                    type="button"
                    className="h-[30px] w-[30px] rounded-full bg-black text-white opacity-60 cursor-pointer hover:opacity-80"
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
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onInput={(e) => {
                      // 모바일/IME 환경에서 Backspace는 inputType으로 감지
                      const asAny = e as unknown as {
                        nativeEvent?: { inputType?: string };
                      };
                      const it = asAny?.nativeEvent?.inputType;
                      if (it === "deleteContentBackward") {
                        const now = Date.now();
                        // 키다운 이벤트와 중복 방지
                        if (now - lastBackspaceAtRef.current > 30) {
                          setBackspaceCount((c) => {
                            const next = c + 1;
                            try {
                              sessionStorage.setItem(
                                "reserve.capBackspaces",
                                String(next)
                              );
                            } catch (error) {
                              if (import.meta.env.DEV) {
                                console.warn(
                                  "[CaptchaModal] reserve.capBackspaces 저장 실패 (onInput)",
                                  error
                                );
                              }
                            }
                            return next;
                          });
                          lastBackspaceAtRef.current = now;
                        }
                      }
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace") {
                        const now = Date.now();
                        lastBackspaceAtRef.current = now;
                        setBackspaceCount((c) => {
                          const next = c + 1;
                          try {
                            sessionStorage.setItem(
                              "reserve.capBackspaces",
                              String(next)
                            );
                          } catch (error) {
                            if (import.meta.env.DEV) {
                              console.warn(
                                "[CaptchaModal] reserve.capBackspaces 저장 실패 (onKeyDown)",
                                error
                              );
                            }
                          }
                          return next;
                        });
                      }
                    }}
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
            onClick={onFold ?? onReselect}
            className="underline hover:cursor-pointer"
          >
            잠깐 접어두기↘
          </button>
        </div>
      </div>
    </div>
  );
}
