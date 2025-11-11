import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatSecondsHuman,
  ReserveMetricKeys,
} from "../../utils/reserveMetrics";

type LiveOverrides = {
  // 예매 버튼
  reactionLiveSec?: number;
  nrClicksLive?: number;
  // 보안 문자
  captchaLiveSec?: number;
  capBackspacesLive?: number;
  capWrongLive?: number;
  // 좌석 선정
  seatLiveSec?: number;
  seatClickMissLive?: number;
  seatTakenCountLive?: number;
  // 총 시간
  totalLiveSec?: number;
};

export default function StopwatchHUD({
  live,
  onlyReserve = false,
  onlyCaptcha = false,
}: {
  live?: LiveOverrides;
  onlyReserve?: boolean;
  onlyCaptcha?: boolean;
}) {
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    intervalRef.current = window.setInterval(() => setTick((v) => v + 1), 250);
    return () => {
      if (intervalRef.current != null)
        window.clearInterval(intervalRef.current);
    };
  }, []);

  const readNum = (key: string, def = 0): number => {
    const v = sessionStorage.getItem(key);
    const n = v != null ? Number(v) : def;
    return isNaN(n) ? def : n;
  };

  const values = useMemo(() => {
    // 1,2
    const reactionSec =
      live?.reactionLiveSec ?? readNum(ReserveMetricKeys.rtSec, 0);
    const nrClicks =
      live?.nrClicksLive ?? readNum(ReserveMetricKeys.nrClicks, 0);
    // 3,4,5
    let captchaSec =
      live?.captchaLiveSec ?? readNum("reserve.captchaDurationSec", 0);
    // Live fallback: if no finalized captcha duration, but startAtMs exists, compute live seconds
    if (!live?.captchaLiveSec && (!captchaSec || captchaSec <= 0)) {
      const startRaw = sessionStorage.getItem("reserve.captchaStartAtMs");
      const start = startRaw ? Number(startRaw) : undefined;
      if (start && !Number.isNaN(start)) {
        const diff = (Date.now() - start) / 1000;
        captchaSec = diff > 0 ? Number(diff.toFixed(2)) : 0;
      }
    }
    const capBackspaces =
      live?.capBackspacesLive ?? readNum("reserve.capBackspaces", 0);
    const capWrong = live?.capWrongLive ?? readNum("reserve.capWrong", 0);
    // 6,7,8
    const seatSec =
      live?.seatLiveSec ??
      (() => {
        const v = sessionStorage.getItem("reserve.capToCompleteSec");
        if (v == null) return 0;
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      })();
    const seatClickMiss =
      live?.seatClickMissLive ?? readNum("reserve.seatClickMiss", 0);
    const seatTakenCount =
      live?.seatTakenCountLive ?? readNum("reserve.seatTakenCount", 0);
    // 9
    const totalSec =
      live?.totalLiveSec ??
      (() => {
        const v = sessionStorage.getItem("reserve.totalSec");
        if (v == null) {
          const start = sessionStorage.getItem("reserve.totalStartAtMs");
          if (start) {
            const diff = (Date.now() - Number(start)) / 1000;
            return diff > 0 ? Number(diff.toFixed(2)) : 0;
          }
          return 0;
        }
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      })();

    return {
      reactionSec,
      nrClicks,
      captchaSec,
      capBackspaces,
      capWrong,
      seatSec,
      seatClickMiss,
      seatTakenCount,
      totalSec,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tick,
    live?.reactionLiveSec,
    live?.nrClicksLive,
    live?.captchaLiveSec,
    live?.capBackspacesLive,
    live?.capWrongLive,
    live?.seatLiveSec,
    live?.seatClickMissLive,
    live?.seatTakenCountLive,
    live?.totalLiveSec,
  ]);

  return (
    <div className="fixed top-2 right-2 z-50">
      <div className="rounded-xl border border-gray-200 shadow bg-white/95 backdrop-blur px-3 py-2 min-w-[260px]">
        <div className="flex items-center justify-between">
          <div className="font-bold text-sm text-gray-800">Stopwatch (DEV)</div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-700"
            aria-label="toggle-stopwatch"
          >
            {collapsed ? "펼치기" : "접기"}
          </button>
        </div>
        {!collapsed && (
          <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-700">
            <Section title="예매 버튼 클릭">
              <Row
                label="반응 속도"
                value={
                  values.reactionSec > 0
                    ? formatSecondsHuman(values.reactionSec)
                    : "—"
                }
              />
              <Row label="클릭 실수" value={`${values.nrClicks}회`} />
            </Section>
            {!onlyReserve && !onlyCaptcha && (
              <>
                <Section title="보안 문자">
                  <Row
                    label="소요 시간"
                    value={
                      values.captchaSec > 0
                        ? formatSecondsHuman(values.captchaSec)
                        : "—"
                    }
                  />
                  <Row label="백스페이스" value={`${values.capBackspaces}회`} />
                  <Row label="틀린 횟수" value={`${values.capWrong}회`} />
                </Section>
                <Section title="좌석 선정">
                  <Row
                    label="소요 시간"
                    value={
                      values.seatSec > 0
                        ? formatSecondsHuman(values.seatSec)
                        : "—"
                    }
                  />
                  <Row label="클릭 실수" value={`${values.seatClickMiss}회`} />
                  <Row label="이선좌" value={`${values.seatTakenCount}회`} />
                </Section>
                <Section title="총 소요된 시간">
                  <Row
                    label="전체"
                    value={
                      values.totalSec > 0
                        ? formatSecondsHuman(values.totalSec)
                        : "—"
                    }
                  />
                </Section>
              </>
            )}
            {onlyCaptcha && (
              <Section title="보안 문자">
                <Row
                  label="소요 시간"
                  value={
                    values.captchaSec > 0
                      ? formatSecondsHuman(values.captchaSec)
                      : "—"
                  }
                />
                <Row label="백스페이스" value={`${values.capBackspaces}회`} />
                <Row label="틀린 횟수" value={`${values.capWrong}회`} />
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-gray-100">
      <div className="px-2 py-1 font-semibold text-[#2f56a5] bg-[#eef2ff]">
        {title}
      </div>
      <div className="p-2 space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span className="font-bold text-gray-900">{value}</span>
    </div>
  );
}
