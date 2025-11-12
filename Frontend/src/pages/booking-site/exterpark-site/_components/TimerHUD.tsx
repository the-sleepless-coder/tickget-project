import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  formatSecondsHuman,
  ReserveMetricKeys,
} from "../../../../shared/utils/reserveMetrics";

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

export default function Timer({
  live,
  onlyReserve = false,
  onlyCaptcha = false,
  draggable = false,
}: {
  live?: LiveOverrides;
  onlyReserve?: boolean;
  onlyCaptcha?: boolean;
  draggable?: boolean;
}) {
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const initialPos = (() => {
    // 초기 위치: 우측 상단 근처
    const defaultX =
      typeof window !== "undefined" ? Math.max(window.innerWidth - 300, 8) : 8;
    return { x: defaultX, y: 8 };
  })();
  const positionRef = useRef<{ x: number; y: number }>(initialPos);
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const defaultX =
      typeof window !== "undefined" ? Math.max(window.innerWidth - 300, 8) : 8;
    return { x: defaultX, y: 8 };
  });
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  useEffect(() => {
    intervalRef.current = window.setInterval(() => setTick((v) => v + 1), 250);
    return () => {
      if (intervalRef.current != null)
        window.clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!draggable) return;
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const nx = e.clientX - dragOffsetRef.current.dx;
      const ny = e.clientY - dragOffsetRef.current.dy;
      const clampedX = Math.max(0, Math.min(nx, window.innerWidth - 260));
      const clampedY = Math.max(0, Math.min(ny, window.innerHeight - 100));
      positionRef.current = { x: clampedX, y: clampedY };
      setPosition(positionRef.current);
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggable, isDragging]);

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
        if (v != null) {
          const n = Number(v);
          return isNaN(n) ? 0 : n;
        }
        // Live fallback: captcha 종료 시점이 있으면 현재까지의 경과 시간을 좌석선정 시간으로 표기
        const capEndRaw = sessionStorage.getItem(
          ReserveMetricKeys.captchaEndAtMs
        );
        const capEnd = capEndRaw ? Number(capEndRaw) : undefined;
        if (capEnd && !Number.isNaN(capEnd)) {
          const diff = (Date.now() - capEnd) / 1000;
          return diff > 0 ? Number(diff.toFixed(2)) : 0;
        }
        return 0;
      })();
    const seatClickMiss =
      live?.seatClickMissLive ?? readNum("reserve.seatClickMiss", 0);
    const seatTakenCount =
      live?.seatTakenCountLive ?? readNum("reserve.seatTakenCount", 0);
    // 9 - 총 소요 시간: GameResult와 동일한 계산식 사용 (reaction + captcha + seat)
    const totalSec =
      live?.totalLiveSec ??
      Number((reactionSec + captchaSec + seatSec).toFixed(2));

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
    <div
      className={`fixed ${draggable ? "z-[9999]" : "top-2 right-2 z-50"}`}
      style={draggable ? { top: position.y, left: position.x } : undefined}
    >
      <div className="rounded-xl border border-gray-200 shadow bg-white/95 backdrop-blur px-3 py-2 min-w-[260px]">
        <div
          className={`flex items-center justify-between ${
            draggable ? "cursor-move select-none" : ""
          }`}
          onMouseDown={(e) => {
            if (!draggable) return;
            setIsDragging(true);
            dragOffsetRef.current = {
              dx: e.clientX - positionRef.current.x,
              dy: e.clientY - positionRef.current.y,
            };
          }}
        >
          <div className="font-bold text-sm text-gray-800">타이머</div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-700"
            aria-label="toggle-timer"
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
                    : "측정 전"
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
                        : "측정 전"
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
                        : "측정 전"
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
                        : "측정 전"
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
                      : "측정 전"
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

function Section({ title, children }: { title: string; children: ReactNode }) {
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
