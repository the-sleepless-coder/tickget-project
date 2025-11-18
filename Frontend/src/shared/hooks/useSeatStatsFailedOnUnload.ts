import { useEffect } from "react";
import { sendSeatStatsFailedForMatch } from "@features/booking-site/api";

/**
 * 창/탭을 닫거나 다른 사이트로 이동하는 시점에
 * 현재 매치에 대한 실패 통계를 한 번 전송하려는 훅.
 *
 * - 내부에서 matchId/userId 유효 여부와 중복 여부를 모두 검사하므로
 *   안전하게 여러 페이지에서 동시에 사용 가능하다.
 * - 새로고침은 실패로 처리하지 않음 (performance.navigation + 플래그로 구분)
 */
export function useSeatStatsFailedOnUnload(trigger: string) {
  useEffect(() => {
    // 페이지 로드 시: 새로고침 여부 확인
    const isReload = (() => {
      try {
        // performance.navigation API로 새로고침 확인
        const entries = performance.getEntriesByType(
          "navigation"
        ) as PerformanceNavigationTiming[];
        if (entries.length > 0 && entries[0].type === "reload") {
          return true;
        }
        // 구형 API (deprecated이지만 여전히 작동)
        const nav = (
          performance as {
            navigation?: { type?: number };
          }
        ).navigation;
        if (nav && nav.type === 1) {
          // TYPE_RELOAD = 1
          return true;
        }
      } catch {
        // 확인 실패는 새로고침이 아닌 것으로 간주
      }
      return false;
    })();

    // 이전 beforeunload에서 설정한 플래그 확인
    // (새로고침 직전에 beforeunload가 발생하고 플래그가 설정됨)
    try {
      const wasReloading = sessionStorage.getItem("reserve.isReloading");
      if (wasReloading === "true") {
        // 이전에 새로고침 플래그가 설정되어 있었다면 새로고침으로 간주
        sessionStorage.removeItem("reserve.isReloading");
        // 새로고침이면 리스너 등록하지 않음
        return;
      }
    } catch {
      // sessionStorage 접근 실패는 무시
    }

    // 새로고침이면 리스너 등록하지 않음
    if (isReload) {
      return;
    }

    const handler = () => {
      // beforeunload 이벤트 발생 시 플래그 설정
      // (다음 페이지 로드 시 새로고침 여부 확인용)
      // 새로고침인지 확인하기 위해 performance.navigation을 확인
      try {
        const nav = (
          performance as {
            navigation?: { type?: number };
          }
        ).navigation;
        // TYPE_RELOAD = 1 (새로고침)
        // TYPE_BACK_FORWARD = 2 (뒤로/앞으로 가기)
        // TYPE_NAVIGATE = 0 (일반 네비게이션)
        if (nav && (nav.type === 1 || nav.type === 2)) {
          // 새로고침 또는 뒤로/앞으로 가기인 경우 플래그 설정
          sessionStorage.setItem("reserve.isReloading", "true");
          if (import.meta.env.DEV) {
            console.log(
              "⏭️ [beforeunload] 새로고침/뒤로가기 감지됨, 실패 API 전송 건너뜀"
            );
          }
          return;
        }
      } catch {
        // 확인 실패는 무시하고 계속 진행
      }

      // 실제 이탈(탭 닫기, 다른 사이트로 이동)인 경우에만 실패 API 호출
      void sendSeatStatsFailedForMatch(undefined, {
        trigger: `${trigger}:beforeunload`,
      });
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [trigger]);
}
