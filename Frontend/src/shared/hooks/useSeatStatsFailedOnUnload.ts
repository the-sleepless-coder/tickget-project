import { useEffect } from "react";
import { sendSeatStatsFailedForMatch } from "@features/booking-site/api";

/**
 * 창/탭을 닫거나 다른 사이트로 이동하는 시점에
 * 현재 매치에 대한 실패 통계를 한 번 전송하려는 훅.
 *
 * - 내부에서 matchId/userId 유효 여부와 중복 여부를 모두 검사하므로
 *   안전하게 여러 페이지에서 동시에 사용 가능하다.
 * - 새로고침은 실패로 처리하지 않음 (URL 비교 방식으로 구분)
 */
export function useSeatStatsFailedOnUnload(trigger: string) {
  useEffect(() => {
    // 페이지 로드 시: 새로고침 여부 확인
    const isReload = (() => {
      try {
        const savedUrl = sessionStorage.getItem("reserve.lastUrl");
        const currentUrl = window.location.href;

        // 저장된 URL과 현재 URL이 같으면 새로고침으로 간주
        if (savedUrl === currentUrl) {
          sessionStorage.removeItem("reserve.lastUrl");
          return true;
        }

        // 현재 URL 저장 (다음 beforeunload에서 비교용)
        sessionStorage.setItem("reserve.lastUrl", currentUrl);
      } catch {
        // sessionStorage 접근 실패는 새로고침이 아닌 것으로 간주
      }
      return false;
    })();

    // 새로고침이면 실패 API를 호출하지 않음
    if (isReload) {
      return;
    }

    const handler = () => {
      // 현재 URL 저장 (다음 페이지 로드에서 비교용)
      try {
        sessionStorage.setItem("reserve.lastUrl", window.location.href);
      } catch {
        // sessionStorage 저장 실패는 무시
      }

      // 실제 이탈(탭 닫기, 다른 사이트로 이동)인 경우 실패 API 호출
      void sendSeatStatsFailedForMatch(undefined, {
        trigger: `${trigger}:beforeunload`,
      });
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [trigger]);
}
