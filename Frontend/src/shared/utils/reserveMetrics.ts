const KEYS = {
  rtSec: "reserve.rtSec",
  nrClicks: "reserve.nrClicks",
  captchaEndAtMs: "reserve.captchaEndAtMs",
  captchaDurationSec: "reserve.captchaDurationSec",
  capBackspaces: "reserve.capBackspaces",
  capWrong: "reserve.capWrong",
  capToCompleteSec: "reserve.capToCompleteSec",
  totalStartAtMs: "reserve.totalStartAtMs",
  totalSec: "reserve.totalSec",
} as const;

export function saveInitialReaction(
  rtSec?: string | null,
  nrClicks?: string | null
): void {
  if (rtSec != null) sessionStorage.setItem(KEYS.rtSec, rtSec);
  if (nrClicks != null) sessionStorage.setItem(KEYS.nrClicks, nrClicks);
}

export function setCaptchaEndNow(
  captchaSec: number,
  backspaces: number,
  wrongAttempts: number
): number {
  const endMs = Date.now();
  sessionStorage.setItem(KEYS.captchaEndAtMs, String(endMs));
  sessionStorage.setItem(KEYS.captchaDurationSec, String(captchaSec));
  sessionStorage.setItem(KEYS.capBackspaces, String(backspaces));
  sessionStorage.setItem(KEYS.capWrong, String(wrongAttempts));
  return endMs;
}

export function getCaptchaEndMs(): number | null {
  const v = sessionStorage.getItem(KEYS.captchaEndAtMs);
  return v ? Number(v) : null;
}

export function recordSeatCompleteNow(): number | null {
  const now = Date.now();
  const end = getCaptchaEndMs();
  // 밀리초 단위로 계산 후 초 단위로 변환 (소수점 2자리까지)
  const durationSec = end
    ? Math.max(0, Number(((now - end) / 1000).toFixed(2)))
    : null;
  if (durationSec != null)
    sessionStorage.setItem(KEYS.capToCompleteSec, String(durationSec));
  return durationSec;
}

export function setTotalStartAtMs(startMs?: number): number {
  const ms = startMs ?? Date.now();
  sessionStorage.setItem(KEYS.totalStartAtMs, String(ms));
  // 측정 재시작 시 이전 totalSec은 초기화
  sessionStorage.removeItem(KEYS.totalSec);
  return ms;
}

export function getTotalStartAtMs(): number | null {
  const v = sessionStorage.getItem(KEYS.totalStartAtMs);
  return v ? Number(v) : null;
}

export function finalizeTotalNow(): number | null {
  const start = getTotalStartAtMs();
  if (!start) return null;
  const sec = Math.max(0, Number(((Date.now() - start) / 1000).toFixed(2)));
  sessionStorage.setItem(KEYS.totalSec, String(sec));
  return sec;
}

export function buildMetricsQueryFromStorage(): string {
  const params = new URLSearchParams();
  const entries: Array<[key: string, storageKey: string]> = [
    ["rtSec", KEYS.rtSec],
    ["nrClicks", KEYS.nrClicks],
    ["captchaSec", KEYS.captchaDurationSec],
    ["capToCompleteSec", KEYS.capToCompleteSec],
    ["capBackspaces", KEYS.capBackspaces],
    ["capWrong", KEYS.capWrong],
    ["seatClickMiss", "reserve.seatClickMiss"],
    ["seatTakenCount", "reserve.seatTakenCount"],
    ["tStart", KEYS.totalStartAtMs],
    ["totalSec", KEYS.totalSec],
  ];
  for (const [key, storageKey] of entries) {
    const v = sessionStorage.getItem(storageKey);
    if (v != null) params.set(key, v);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function readMetricsWithFallback(sp: URLSearchParams): {
  rtSec: number;
  nrClicks: number;
  captchaSec: number | null;
  capToCompleteSec: number | null;
  capBackspaces: number | null;
  capWrong: number | null;
  seatClickMiss: number | null;
  seatTakenCount: number | null;
} {
  const getNum = (param: string, storageKey: string, nullable = false) => {
    const v = sp.get(param) ?? sessionStorage.getItem(storageKey);
    if (v == null) return nullable ? null : 0;
    const n = Number(v);
    return (isNaN(n) ? 0 : n) as any;
  };
  return {
    rtSec: getNum("rtSec", KEYS.rtSec),
    nrClicks: getNum("nrClicks", KEYS.nrClicks),
    captchaSec: getNum("captchaSec", KEYS.captchaDurationSec, true),
    capToCompleteSec: getNum("capToCompleteSec", KEYS.capToCompleteSec, true),
    capBackspaces: getNum("capBackspaces", KEYS.capBackspaces, true),
    capWrong: getNum("capWrong", KEYS.capWrong, true),
    seatClickMiss: getNum("seatClickMiss", "reserve.seatClickMiss", true),
    seatTakenCount: getNum("seatTakenCount", "reserve.seatTakenCount", true),
  };
}

export function formatSecondsHuman(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s.toFixed(2)} 초` : `${s.toFixed(2)} 초`;
}

export const ReserveMetricKeys = KEYS;

export function resetSeatSelectionMetrics(): void {
  const keysToRemove = [
    KEYS.captchaEndAtMs,
    KEYS.captchaDurationSec,
    KEYS.capBackspaces,
    KEYS.capWrong,
    KEYS.capToCompleteSec,
    "reserve.captchaStartAtMs",
    "reserve.seatClickMiss",
    "reserve.seatTakenCount",
  ];
  for (const key of keysToRemove) {
    sessionStorage.removeItem(key);
  }
}
