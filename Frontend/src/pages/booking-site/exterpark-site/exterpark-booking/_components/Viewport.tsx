import { useCallback, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import { useAuthStore } from "@features/auth/store";
import { useRoomStore } from "@features/room/store";
import { exitRoom } from "@features/room/api";
import { sendSeatStatsFailedForMatch } from "@features/booking-site/api";
import { useMatchStore } from "@features/booking-site/store";
import { paths } from "../../../../../app/routes/paths";
import { buildMetricsQueryFromStorage } from "../../../../../shared/utils/reserveMetrics";

type Props = PropsWithChildren<{
  className?: string;
  scroll?: boolean;
}>;

export default function Viewport({
  children,
  className = "",
  scroll = false,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUserId = useAuthStore((s) => s.userId);
  const currentUserNickname = useAuthStore((s) => s.nickname);
  const storeRoomId = useRoomStore((s) => s.roomInfo.roomId);
  const clearRoomInfo = useRoomStore((s) => s.clearRoomInfo);
  const matchIdFromStore = useMatchStore((s) => s.matchId);
  const [isExiting, setIsExiting] = useState(false);
  const [rootElement, setRootElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRootElement(document.getElementById("root"));
  }, []);

  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    const prev = {
      backgroundColor: root.style.backgroundColor,
      backgroundImage: root.style.backgroundImage,
    };
    root.style.backgroundColor = "#1f1f1f";
    root.style.backgroundImage = "none";
    return () => {
      root.style.backgroundColor = prev.backgroundColor;
      root.style.backgroundImage = prev.backgroundImage;
    };
  }, []);

  useEffect(() => {
    // 내부 뷰포트가 900x680이 되도록 창 크기를 보정
    const targetW = 910;
    const targetH = 700;
    const dw = targetW - window.innerWidth;
    const dh = targetH - window.innerHeight;
    if (dw !== 0 || dh !== 0) {
      try {
        window.resizeBy(dw, dh);
      } catch {
        // 일부 브라우저 정책으로 실패할 수 있으므로 무시
      }
    }
  }, []);
  useEffect(() => {
    // booking 전용: 전역 body 스타일을 리셋하여 정확한 900x682 영역 확보
    const bodyStyle = document.body.style;
    const prev = {
      padding: bodyStyle.padding,
      display: bodyStyle.display,
      justifyContent: bodyStyle.justifyContent,
      alignItems: bodyStyle.alignItems,
    } as const;
    bodyStyle.padding = "0";
    bodyStyle.display = "block";
    bodyStyle.justifyContent = "";
    bodyStyle.alignItems = "";
    return () => {
      bodyStyle.padding = prev.padding;
      bodyStyle.display = prev.display;
      bodyStyle.justifyContent = prev.justifyContent;
      bodyStyle.alignItems = prev.alignItems;
    };
  }, []);

  const queryRoomId = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search);
      const raw = params.get("roomId");
      if (raw && !Number.isNaN(Number(raw))) {
        return Number(raw);
      }
    } catch {
      // noop
    }
    return undefined;
  }, [location.search]);

  const resolvedRoomId = storeRoomId ?? queryRoomId;
  const queryMatchId = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search);
      const raw = params.get("matchId");
      if (raw && !Number.isNaN(Number(raw))) {
        return Number(raw);
      }
    } catch {
      // noop
    }
    return null;
  }, [location.search]);
  const resolvedMatchId = matchIdFromStore ?? queryMatchId ?? undefined;
  const isBookingRoute = location.pathname.startsWith(paths.booking.root);
  const shouldShowExitButton =
    Boolean(resolvedRoomId) && isBookingRoute && Boolean(rootElement);

  const handleExitRoom = useCallback(async () => {
    if (!resolvedRoomId || !currentUserId || !currentUserNickname) {
      navigate(paths.home, { replace: true });
      return;
    }

    const ok = window.confirm("정말 방을 나가시겠습니까?");
    if (!ok) return;

    setIsExiting(true);
    try {
      try {
        await sendSeatStatsFailedForMatch(resolvedMatchId, {
          trigger: "EXIT_ROOM@Viewport",
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("좌석 실패 통계 전송 실패:", error);
        }
      }
      await exitRoom(resolvedRoomId, {
        userId: currentUserId,
        userName: currentUserNickname,
      });
      clearRoomInfo();

      const metricsQs = buildMetricsQueryFromStorage();
      const extraParams = new URLSearchParams();
      if (resolvedRoomId) {
        extraParams.set("roomId", String(resolvedRoomId));
      }
      extraParams.set("failed", "true");
      const extraQuery = extraParams.toString();
      const target =
        paths.booking.gameResult +
        (metricsQs ? `${metricsQs}&${extraQuery}` : `?${extraQuery}`);

      window.location.replace(target);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("방 나가기 실패:", error);
      }
      alert("방 나가기에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsExiting(false);
    }
  }, [
    resolvedRoomId,
    currentUserId,
    currentUserNickname,
    navigate,
    clearRoomInfo,
    resolvedMatchId,
  ]);

  const exitButtonPortal =
    shouldShowExitButton && rootElement
      ? createPortal(
          <button
            type="button"
            onClick={handleExitRoom}
            disabled={isExiting}
            className="fixed top-4 right-5 z-[9999] inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MeetingRoomOutlinedIcon fontSize="small" />
            <span>{isExiting ? "나가는 중..." : "방 나가기"}</span>
          </button>,
          rootElement
        )
      : null;

  return (
    <>
      <div className="w-[880px] h-[680px] bg-[#efefef] mx-auto">
        <div
          className={
            (scroll ? "h-full overflow-y-auto " : "h-full ") + className
          }
        >
          {children}
        </div>
      </div>
      {exitButtonPortal}
    </>
  );
}
