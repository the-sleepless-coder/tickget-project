import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { paths } from "../../../../app/routes/paths";
import BookingLayout from "./_components/BookingLayout";
import { buildMetricsQueryFromStorage } from "../../../../shared/utils/reserveMetrics";
import { useMatchStore } from "@features/booking-site/store";
import { useAuthStore } from "@features/auth/store";
import {
  buildSeatMetricsPayload,
  confirmSeat,
} from "@features/booking-site/api";
import { useSeatStatsFailedOnUnload } from "../../../../shared/hooks/useSeatStatsFailedOnUnload";
import { useBlockBackButtonDuringGame } from "../../../../shared/hooks/useBlockBackButtonDuringGame";
import dayjs from "dayjs";

type SeatData = {
  grade: string;
  count: number;
  price: number;
};

export default function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [method, setMethod] = useState<string>("kakao");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 카드 할부 등 추가 옵션이 생기면 확장 예정
  const matchIdFromStore = useMatchStore((s) => s.matchId);
  const currentUserId = useAuthStore((s) => s.userId);

  // 결제 단계에서 창을 닫는 경우에도 실패 통계 전송 시도
  useSeatStatsFailedOnUnload("05-Payment");

  // 경기 중 브라우저 뒤로가기 차단
  useBlockBackButtonDuringGame("05-Payment");

  const goPrev = () => {
    const prevParams = searchParams.toString();
    const target =
      paths.booking.orderConfirm + (prevParams ? `?${prevParams}` : "");
    navigate(target);
  };
  const complete = async () => {
    if (isSubmitting) {
      console.warn("[seat-confirm] 이미 결제 요청을 처리 중입니다.");
      return;
    }
    setIsSubmitting(true);
    try {
      // matchId 결정: store 우선, 없으면 URL 파라미터에서 가져오기
      const matchIdParam = searchParams.get("matchId");
      const matchId =
        matchIdFromStore ??
        (matchIdParam && !Number.isNaN(Number(matchIdParam))
          ? Number(matchIdParam)
          : null);

      // API 호출: 좌석 확정
      if (matchId && currentUserId) {
        try {
          // SeatConfirmRequest와 동일한 메트릭 페이로드 공통 빌더 사용
          const payload = buildSeatMetricsPayload(currentUserId);

          console.log("[seat-confirm] API 호출:", {
            matchId,
            payload,
          });

          const response = await confirmSeat(matchId, payload);
          console.log("[seat-confirm] API 응답:", response);

          // userRank / totalRank를 sessionStorage에 저장
          if (response.body && typeof response.body.userRank === "number") {
            sessionStorage.setItem(
              "reserve.userRank",
              String(response.body.userRank)
            );
          }
          if (response.body && typeof response.body.totalRank === "number") {
            sessionStorage.setItem(
              "reserve.totalRank",
              String(response.body.totalRank)
            );
          }

          // matchId를 store에 업데이트
          if (response.body && response.body.matchId) {
            const responseMatchId = Number(response.body.matchId);
            if (!Number.isNaN(responseMatchId)) {
              useMatchStore.getState().setMatchId(responseMatchId);
              console.log("[seat-confirm] matchId 업데이트:", responseMatchId);
            }
          }
        } catch (error) {
          console.error("[seat-confirm] API 호출 실패:", error);
        }
      } else {
        console.warn(
          "[seat-confirm] matchId 또는 userId가 없어 API 호출을 건너뜁니다.",
          { matchId, currentUserId }
        );
      }

      // 기존 동작: 게임 결과 페이지로 이동
      const qs = buildMetricsQueryFromStorage();
      // userRank가 있으면 추가 (기존 동작 유지)
      const userRank = sessionStorage.getItem("reserve.userRank");
      const finalQs = userRank
        ? qs + (qs ? "&" : "?") + `userRank=${encodeURIComponent(userRank)}`
        : qs;
      // 경로 수정: paths.booking.gameResult 사용 (실제 게임 결과 페이지 경로)
      const target = paths.booking.gameResult + finalQs;

      // window.opener가 있어도 현재 창에서 navigate 사용 (세션 유지)
      // 부모 창이 있으면 postMessage로 알림 (선택사항)
      try {
        if (window.opener && !window.opener.closed) {
          // 부모 창에 결과 페이지로 이동하라는 메시지 전달
          window.opener.postMessage(
            {
              type: "booking-complete",
              targetUrl: target,
            },
            window.location.origin
          );
        }
      } catch (error) {
        console.warn("[Payment] 부모 창에 메시지 전달 실패:", error);
      }

      // 현재 창에서 결과 페이지로 이동 (세션 유지)
      navigate(target);
    } finally {
      setIsSubmitting(false);
    }
  };

  // URL에서 선택 좌석 정보 가져오기
  const seatsParam = searchParams.get("seats");
  const selectedSeats: SeatData[] = useMemo(() => {
    if (!seatsParam) {
      return [{ grade: "SR석", count: 1, price: 143000 }]; // 기본값
    }
    try {
      const parsed = JSON.parse(decodeURIComponent(seatsParam));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return [{ grade: "SR석", count: 1, price: 143000 }]; // 기본값
    } catch (e) {
      console.error("좌석 정보 파싱 실패:", e);
      return [{ grade: "SR석", count: 1, price: 143000 }]; // 기본값
    }
  }, [seatsParam]);

  // 선택 좌석 요약 텍스트
  const selectedSeatsSummary = useMemo(() => {
    return selectedSeats.map((s) => `${s.grade} ${s.count}석`).join(", ");
  }, [selectedSeats]);

  // 가격 정보
  const ticketPrice = Number(searchParams.get("totalPrice")) || 143000;
  const fee = Number(searchParams.get("fee")) || 2000;
  const shipping = Number(searchParams.get("deliveryFee")) || 3700;
  const total =
    Number(searchParams.get("total")) || ticketPrice + fee + shipping;

  // 날짜/시간 정보
  const dateParam = searchParams.get("date");
  const timeParam = searchParams.get("time");
  const formattedDateTime = useMemo(() => {
    if (!dateParam) return "2025.12.20 (토) 18:00"; // 기본값
    const date = dayjs(dateParam);
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.day()];
    const time = timeParam || "18:00";
    return `${date.format("YYYY.MM.DD")} (${weekday}) ${time}`;
  }, [dateParam, timeParam]);

  return (
    <BookingLayout activeStep={4}>
      <div className="p-3 grid grid-cols-[200px_1fr_260px] gap-3">
        {/* 좌측: 결제방식 선택 */}
        <section className="bg-white rounded-md shadow border border-[#e3e3e3] h-full">
          <header className="px-3 py-2 font-bold border-b">결제방식선택</header>
          <div className="p-2 text-sm space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pay"
                checked={method === "kakao"}
                onChange={() => setMethod("kakao")}
              />
              카카오페이{" "}
              <span className="ml-1 inline-block text-[10px] px-1 py-0.5 rounded bg-[#3b82f6] text-white">
                EVENT
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pay"
                checked={method === "bank"}
                onChange={() => setMethod("bank")}
              />{" "}
              무통장입금
            </label>
          </div>
        </section>

        {/* 가운데: 결제수단 입력 - 선택된 방식에 따라 렌더 */}
        <section className="bg-white rounded-md shadow border border-[#e3e3e3] flex flex-col h-full">
          <header className="px-3 py-2 font-bold border-b flex-shrink-0">
            <span>결제수단입력</span>
          </header>
          {method === "bank" ? (
            <div className="p-2.5 text-xs space-y-2 flex-1 overflow-y-auto">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-gray-700 w-20 flex-shrink-0">
                    입금액
                  </span>
                  <span className="font-bold">{total.toLocaleString()}원</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-700 w-20 flex-shrink-0">
                    입금하실은행
                  </span>
                  <select className="border rounded px-2 py-1 text-xs flex-1">
                    <option>국민은행</option>
                    <option>신한은행</option>
                    <option>하나은행</option>
                    <option>우리은행</option>
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-[#b02a2a] leading-3.5">
                은행에 따라 밤 11시 30분 이후에는 온라인 입금이 지연될 수
                있습니다. 선택한 은행의 입금계좌는 예매확인페이지에서
                부여받으시게 됩니다.
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-gray-700 w-20 flex-shrink-0">
                    입금마감시간
                  </span>
                  <span className="text-xs">2025.12.16 23:59</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-700 w-20 flex-shrink-0">
                    예금주명
                  </span>
                  <span className="text-xs">㈜놀유서비스</span>
                </div>
              </div>

              <div className="mt-2 border-t pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="font-semibold text-xs">현금영수증</div>
                  <label className="text-xs flex items-center gap-1">
                    <input type="checkbox" defaultChecked className="w-3 h-3" />{" "}
                    신청
                  </label>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="text-gray-700 w-20 flex-shrink-0 text-xs">
                      발급 용도
                    </span>
                    <div className="flex flex-col gap-1">
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="radio"
                          name="crPurpose"
                          defaultChecked
                          className="w-3 h-3"
                        />{" "}
                        개인소득공제
                      </label>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="radio"
                          name="crPurpose"
                          className="w-3 h-3"
                        />{" "}
                        사업자지출증빙
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 w-20 flex-shrink-0 text-xs">
                      발급기준
                    </span>
                    <select className="border rounded px-2 py-1 text-xs flex-1">
                      <option>휴대폰번호</option>
                      <option>현금영수증카드</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 w-20 flex-shrink-0 text-xs">
                      휴대폰번호
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        className="border rounded px-1.5 py-1 w-14 text-xs"
                        defaultValue="010"
                      />
                      <span>-</span>
                      <input
                        className="border rounded px-1.5 py-1 w-16 text-xs"
                        defaultValue="1234"
                      />
                      <span>-</span>
                      <input
                        className="border rounded px-1.5 py-1 w-16 text-xs"
                        defaultValue="5678"
                      />
                    </div>
                  </div>
                </div>
                <label className="mt-1.5 inline-flex items-center gap-1.5 text-[10px]">
                  <input type="checkbox" className="w-3 h-3" /> 현금영수증 정보
                  저장
                </label>
              </div>
            </div>
          ) : (
            <div className="p-3 text-sm space-y-3">
              <div className="font-semibold mb-1">카카오페이 결제</div>
              <p className="text-gray-600">
                결제하기 버튼을 클릭하시면 카카오페이 결제창으로 이동합니다.
              </p>
            </div>
          )}
        </section>

        {/* 우측: My 예매정보 */}
        <aside className="bg-white rounded-md p-2.5 shadow border border-[#e3e3e3] h-full flex flex-col">
          <div className="text-sm font-semibold mb-2 flex-shrink-0">
            My예매정보
          </div>
          <dl className="text-sm text-gray-700 flex-1 overflow-y-auto min-h-0">
            <div className="flex py-1 border-b">
              <dt className="w-20 text-gray-500 text-xs">일시</dt>
              <dd className="flex-1 text-xs">{formattedDateTime}</dd>
            </div>
            <div className="flex py-1 border-b">
              <dt className="w-20 text-gray-500 text-xs">선택좌석</dt>
              <dd className="flex-1 text-xs">{selectedSeatsSummary}</dd>
            </div>
            <div className="flex py-1 border-b">
              <dt className="w-20 text-gray-500 text-xs">티켓금액</dt>
              <dd className="flex-1 text-xs">
                {ticketPrice.toLocaleString()}원
              </dd>
            </div>
            <div className="flex py-1 border-b">
              <dt className="w-20 text-gray-500 text-xs">수수료</dt>
              <dd className="flex-1 text-xs">{fee.toLocaleString()}원</dd>
            </div>
            <div className="flex py-1 border-b">
              <dt className="w-20 text-gray-500 text-xs">배송료</dt>
              <dd className="flex-1 text-xs">
                {shipping.toLocaleString()}원 | 배송
              </dd>
            </div>
            <div className="flex py-1">
              <dt className="w-20 text-gray-500 text-xs">총 결제금액</dt>
              <dd className="flex-1 font-extrabold text-xs">
                {total.toLocaleString()}원
              </dd>
            </div>
          </dl>

          <div className="mt-2 flex gap-2 flex-shrink-0">
            <button
              onClick={goPrev}
              className="flex-1 bg-[#5a5a5a] hover:bg-[#4a4a4a] text-white rounded-md py-2 font-semibold"
            >
              이전단계
            </button>
            <button
              onClick={complete}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="flex-1 bg-[linear-gradient(to_bottom,#4383fb,#104bb7)] text-white rounded-md py-2 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "결제 중..." : "결제하기"}
            </button>
          </div>
        </aside>
      </div>
    </BookingLayout>
  );
}
