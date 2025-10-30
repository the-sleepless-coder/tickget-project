const KEYS = {
  rtSec: "reserve.rtSec",
  nrClicks: "reserve.nrClicks",
  captchaEndAtMs: "reserve.captchaEndAtMs",
  captchaDurationSec: "reserve.captchaDurationSec",
  capBackspaces: "reserve.capBackspaces",
  capWrong: "reserve.capWrong",
  capToCompleteSec: "reserve.capToCompleteSec",
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
  const durationSec = end ? Math.max(0, Math.round((now - end) / 1000)) : null;
  if (durationSec != null)
    sessionStorage.setItem(KEYS.capToCompleteSec, String(durationSec));
  return durationSec;
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
  captchaSec: number;
  capToCompleteSec: number | null;
  capBackspaces: number | null;
  capWrong: number | null;
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
    captchaSec: getNum("captchaSec", KEYS.captchaDurationSec),
    capToCompleteSec: getNum("capToCompleteSec", KEYS.capToCompleteSec, true),
    capBackspaces: getNum("capBackspaces", KEYS.capBackspaces, true),
    capWrong: getNum("capWrong", KEYS.capWrong, true),
  };
}

export function formatSecondsHuman(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s.toFixed(2)} 초` : `${s.toFixed(2)} 초`;
}

export const ReserveMetricKeys = KEYS;
