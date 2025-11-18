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
        console.log(
          `[useBlockBackButtonDuringGame] ${trigger}: matchId가 없어 뒤로가기 차단 비활성화`
        );
      }
      return;
    }

    if (import.meta.env.DEV) {
      console.log(
        `[useBlockBackButtonDuringGame] ${trigger}: 경기 중 감지, 뒤로가기 차단 활성화 (matchId: ${matchId})`
      );
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
        console.log(
          `[useBlockBackButtonDuringGame] ${trigger}: popstate 이벤트 감지`,
          event
        );
      }

      // 즉시 현재 페이지에 머물도록 다시 푸시 (React Router 라우팅 변경 전에)
      pushState();

      // 확인 다이얼로그 표시 (동기적으로 즉시 실행)
      const confirmed = confirm("정말 방을 나가시겠습니까?");
      if (!confirmed) {
        if (import.meta.env.DEV) {
          console.log(
            `[useBlockBackButtonDuringGame] ${trigger}: 사용자가 취소함`
          );
        }
        // 취소 시 다시 pushState (React Router가 이미 라우팅을 변경했을 수 있음)
        pushState();
        return;
      }

      if (import.meta.env.DEV) {
        console.log(
          `[useBlockBackButtonDuringGame] ${trigger}: 사용자가 확인함, 실패 API 호출 및 결과 페이지로 이동`
        );
      }

      // 확인 시 실패 API 호출 및 실패 결과 페이지로 이동
      const handleExit = async () => {
        try {
          // matchId 재확인 (비동기 처리 전에 최신 값 가져오기)
          const currentMatchId =
            useMatchStore.getState().matchId ??
            (() => {
              const urlParams = new URLSearchParams(window.location.search);
              const urlMatchId = urlParams.get("matchId");
              return urlMatchId && !Number.isNaN(Number(urlMatchId))
                ? Number(urlMatchId)
                : null;
            })();

          // 실패 API 호출
          await sendSeatStatsFailedForMatch(currentMatchId ?? undefined, {
            trigger: `BACK@${trigger}`,
          });
        } catch (error) {
          console.error(
            "[useBlockBackButtonDuringGame] 실패 API 호출 실패:",
            error
          );
        } finally {
          // 실패해도 결과 페이지로 이동
          recordSeatCompleteNow();
          const metricsQs = buildMetricsQueryFromStorage();
          const prefix = metricsQs ? `${metricsQs}&` : "?";
          const target = paths.booking.gameResult + `${prefix}failed=true`;
          navigate(target, { replace: true });
        }
      };

      void handleExit();
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
