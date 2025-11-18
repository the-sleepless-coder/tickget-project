import { useEffect } from "react";
import { sendSeatStatsFailedForMatch } from "@features/booking-site/api";

/**
 * 창/탭을 닫거나 다른 사이트로 이동하는 시점에
 * 현재 매치에 대한 실패 통계를 한 번 전송하려는 훅.
 *
 * - 내부에서 matchId/userId 유효 여부와 중복 여부를 모두 검사하므로
 *   안전하게 여러 페이지에서 동시에 사용 가능하다.
 */
export function useSeatStatsFailedOnUnload(trigger: string) {
  useEffect(() => {
    const handler = () => {
      // 비동기 결과는 기다리지 않고 fire-and-forget으로 호출
      void sendSeatStatsFailedForMatch(undefined, {
        trigger: `${trigger}:beforeunload`,
      });
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [trigger]);
}
