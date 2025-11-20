import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMatchStore } from "@features/booking-site/store";
import { useAuthStore } from "@features/auth/store";
import { sendSeatStatsFailedForMatch } from "@features/booking-site/api";
import {
  buildMetricsQueryFromStorage,
  recordSeatCompleteNow,
} from "../utils/reserveMetrics";
import { paths } from "../../app/routes/paths";
import { showConfirm } from "../utils/confirm";

/**
 * 경기 중 브라우저 뒤로가기를 막고, 확인 시 실패 API 호출 후 실패 결과 페이지로 이동하는 훅
 * @param trigger - 실패 API 호출 시 사용할 트리거 식별자 (예: "02-Seats", "03-Price")
 */
export function useBlockBackButtonDuringGame(trigger: string) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const matchIdFromStore = useMatchStore((s) => s.matchId);
  const currentUserId = useAuthStore((s) => s.userId);

  useEffect(() => {
    // matchId 확인: store 우선, 없으면 URL 파라미터에서 가져오기
    const matchIdParam = searchParams.get("matchId");
    const matchId =
      matchIdFromStore ??
      (matchIdParam && !Number.isNaN(Number(matchIdParam))
        ? Number(matchIdParam)
        : null);

    // matchId가 없으면 경기 중이 아니므로 리스너 등록하지 않음
    if (matchId === null) {
      if (import.meta.env.DEV) {
      
      }
      return;
    }

    if (import.meta.env.DEV) {
    }

    // 현재 위치를 한 번 더 쌓아 뒤로가기를 중단시킴
    const pushState = () => {
      try {
        window.history.pushState(null, "", window.location.href);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn("history.pushState 실패:", err);
        }
      }
    };

    // 초기 pushState (페이지 마운트 시)
    pushState();

    // 추가 pushState (약간의 지연 후) - React Router와의 타이밍 이슈 해결
    const timeoutId = setTimeout(() => {
      pushState();
    }, 100);

    const onPopState = (event: PopStateEvent) => {
      if (import.meta.env.DEV) {
      }

      // 즉시 현재 페이지에 머물도록 다시 푸시 (React Router 라우팅 변경 전에)
      pushState();

      void (async () => {
        const confirmed = await showConfirm(
          "정말 방을 나가시겠습니까?\n취소하면 현재 화면을 유지합니다.",
          {
            confirmText: "방 나가기",
            cancelText: "취소",
            type: "warning",
          }
        );
        if (!confirmed) {
          if (import.meta.env.DEV) {
            console.log(
              `[useBlockBackButtonDuringGame] ${trigger}: 사용자가 취소함`
            );
          }
          pushState();
          return;
        }

        if (import.meta.env.DEV) {
          console.log(
            `[useBlockBackButtonDuringGame] ${trigger}: 사용자가 확인함, 실패 API 호출 및 결과 페이지로 이동`
          );
        }

        try {
          const currentMatchId =
            useMatchStore.getState().matchId ??
            (() => {
              const urlParams = new URLSearchParams(window.location.search);
              const urlMatchId = urlParams.get("matchId");
              return urlMatchId && !Number.isNaN(Number(urlMatchId))
                ? Number(urlMatchId)
                : null;
            })();

          await sendSeatStatsFailedForMatch(currentMatchId ?? undefined, {
            trigger: `BACK@${trigger}`,
          });
        } catch (error) {
          console.error(
            "[useBlockBackButtonDuringGame] 실패 API 호출 실패:",
            error
          );
        } finally {
          recordSeatCompleteNow();
          const metricsQs = buildMetricsQueryFromStorage();
          const prefix = metricsQs ? `${metricsQs}&` : "?";
          const target = paths.booking.gameResult + `${prefix}failed=true`;
          navigate(target, { replace: true });
        }
      })();
    };

    // capture 단계에서 이벤트 리스너 등록 (React Router보다 먼저 처리)
    window.addEventListener("popstate", onPopState, true);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("popstate", onPopState, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchIdFromStore, navigate, trigger, currentUserId]);
}
