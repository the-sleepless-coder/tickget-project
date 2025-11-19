import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BookingLayout from "./_components/BookingLayout";
import { paths } from "../../../../app/routes/paths";
import { useRoomStore } from "@features/room/store";
import { useMatchStore } from "@features/booking-site/store";
import { useAuthStore } from "@features/auth/store";
import { cancelSeats } from "@features/performance-hall/api";
import { useBlockBackButtonDuringGame } from "../../../../shared/hooks/useBlockBackButtonDuringGame";
import dayjs from "dayjs";
import Thumbnail01 from "../../../../shared/images/thumbnail/Thumbnail01.webp";
import Thumbnail02 from "../../../../shared/images/thumbnail/Thumbnail02.webp";
import Thumbnail03 from "../../../../shared/images/thumbnail/Thumbnail03.webp";
import Thumbnail04 from "../../../../shared/images/thumbnail/Thumbnail04.webp";
import Thumbnail05 from "../../../../shared/images/thumbnail/Thumbnail05.webp";
import Thumbnail06 from "../../../../shared/images/thumbnail/Thumbnail06.webp";

type SeatData = {
  grade: string;
  count: number;
  price: number;
  seats?: Array<{ gradeLabel: string; label: string }>;
};

export default function PricePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomInfo = useRoomStore((s) => s.roomInfo);
  const matchIdFromStore = useMatchStore((s) => s.matchId);
  const currentUserId = useAuthStore((s) => s.userId);
  const fee = 2000;

  // 경기 중 브라우저 뒤로가기 차단
  useBlockBackButtonDuringGame("03-Price");

  // 썸네일 번호 -> 이미지 매핑
  const THUMBNAIL_IMAGES: Record<string, string> = {
    "1": Thumbnail01,
    "2": Thumbnail02,
    "3": Thumbnail03,
    "4": Thumbnail04,
    "5": Thumbnail05,
    "6": Thumbnail06,
  };

  // 썸네일 이미지 경로 계산
  const thumbnailSrc = useMemo(() => {
    if (!roomInfo.thumbnailValue) return null;

    const normalizeS3Url = (value: string): string => {
      return /^https?:\/\//i.test(value)
        ? value
        : `https://s3.tickget.kr/${value}`;
    };

    if (roomInfo.thumbnailType === "PRESET") {
      // PRESET인 경우 썸네일 번호로 이미지 선택
      return THUMBNAIL_IMAGES[roomInfo.thumbnailValue] || Thumbnail03;
    } else if (roomInfo.thumbnailType === "UPLOADED") {
      // UPLOADED인 경우 URL 직접 사용
      return normalizeS3Url(roomInfo.thumbnailValue);
    } else {
      // thumbnailType이 없으면 thumbnailValue 형식으로 판단
      // 숫자 문자열이면 PRESET, 그렇지 않으면 UPLOADED
      if (/^\d+$/.test(roomInfo.thumbnailValue)) {
        return THUMBNAIL_IMAGES[roomInfo.thumbnailValue] || Thumbnail03;
      } else {
        return normalizeS3Url(roomInfo.thumbnailValue);
      }
    }
  }, [roomInfo.thumbnailValue, roomInfo.thumbnailType]);

  // URL에서 선택한 좌석 정보 가져오기
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

  // (unused 계산 제거: seatsByGrade, totalSeatCount)

  // 선택된 좌석 등급 텍스트
  const selectedSeatsText = useMemo(() => {
    if (selectedSeats.length === 0) return "";
    if (selectedSeats.length === 1) {
      const seat = selectedSeats[0];
      return `${seat.grade} | 좌석 ${seat.count}매를 선택하셨습니다.`;
    }
    const grades = selectedSeats
      .map((s) => `${s.grade} ${s.count}매`)
      .join(", ");
    return `${grades}를 선택하셨습니다.`;
  }, [selectedSeats]);
  const discounts = useMemo(
    () => [
      { label: "중중장애인(1~3급/동반1인)20%", rate: 0.2 },
      { label: "경증장애인(4~6급/본인만)20%", rate: 0.2 },
      { label: "국가 유공자(본인만)20%", rate: 0.2 },
    ],
    []
  );

  // 등급별 선택 상태: { grade: "base" | number | null }
  const [selections, setSelections] = useState<
    Record<string, "base" | number | null>
  >(() => {
    const initial: Record<string, "base" | number | null> = {};
    selectedSeats.forEach((seat) => {
      initial[seat.grade] = "base";
    });
    return initial;
  });

  // 등급별 선택된 가격 계산
  const selectedPrices = useMemo(() => {
    const prices: Record<string, number> = {};
    selectedSeats.forEach((seat) => {
      const selection = selections[seat.grade];
      if (selection === "base") {
        prices[seat.grade] = seat.price * seat.count;
      } else if (typeof selection === "number") {
        prices[seat.grade] = Math.round(
          seat.price * (1 - discounts[selection].rate) * seat.count
        );
      } else {
        prices[seat.grade] = 0;
      }
    });
    return prices;
  }, [selections, selectedSeats, discounts]);

  // 총 선택 가격
  const totalSelectedPrice = useMemo(() => {
    return Object.values(selectedPrices).reduce((sum, price) => sum + price, 0);
  }, [selectedPrices]);

  // 총 할인 금액
  const totalDiscountAmount = useMemo(() => {
    let total = 0;
    selectedSeats.forEach((seat) => {
      const selection = selections[seat.grade];
      if (selection !== null && selection !== "base") {
        const originalPrice = seat.price * seat.count;
        const discountedPrice = selectedPrices[seat.grade];
        total += originalPrice - discountedPrice;
      }
    });
    return total;
  }, [selections, selectedSeats, selectedPrices]);

  const total = useMemo(
    () => (totalSelectedPrice > 0 ? totalSelectedPrice + fee : 0),
    [totalSelectedPrice, fee]
  );

  // 날짜/시간 포맷팅
  const dateParam = searchParams.get("date");
  const timeParam = searchParams.get("time");
  const formattedDateTime = useMemo(() => {
    if (!dateParam) return "";
    const date = dayjs(dateParam);
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.day()];
    const time = timeParam || "18:00";
    return `${date.format("YYYY.MM.DD")} (${weekday}) ${time}`;
  }, [dateParam, timeParam]);

  // 선택 좌석 요약 텍스트 (개별 좌석 정보 표시)
  const selectedSeatsSummary = useMemo(() => {
    const seatLabels: string[] = [];
    selectedSeats.forEach((s) => {
      if (s.seats && s.seats.length > 0) {
        // 개별 좌석 정보가 있으면 사용
        s.seats.forEach((seat) => {
          seatLabels.push(`${seat.gradeLabel} ${seat.label}`);
        });
      } else {
        // 개별 좌석 정보가 없으면 등급과 개수만 표시 (하위 호환성)
        seatLabels.push(`${s.grade} ${s.count}석`);
      }
    });
    return seatLabels.join(", ");
  }, [selectedSeats]);

  const goPrev = async () => {
    // matchId 결정: store 우선, 없으면 URL 파라미터에서 가져오기
    const matchIdParam = searchParams.get("matchId");
    const matchId =
      matchIdFromStore ??
      (matchIdParam && !Number.isNaN(Number(matchIdParam))
        ? Number(matchIdParam)
        : null);

    if (matchId && currentUserId) {
      try {
        console.log("[seat-cancel] API 호출:", {
          matchId,
          userId: currentUserId,
          endpoint: `/ticketing/matches/${matchId}/seats/cancel?userId=${currentUserId}`,
          method: "DELETE",
        });
        const response = await cancelSeats(matchId, currentUserId);
        console.log("[seat-cancel] API 응답:", response);
      } catch (err) {
        console.error("[seat-cancel] API 에러:", err);
      }
    } else {
      console.warn(
        "[seat-cancel] matchId 또는 userId가 없어 API 호출을 건너뜁니다.",
        { matchId, currentUserId }
      );
    }
    navigate(paths.booking.selectSeat);
  };
  const goNext = () => {
    const nextUrl = new URL(
      window.location.origin + paths.booking.orderConfirm
    );
    // 선택 좌석 정보 전달
    if (selectedSeats.length > 0) {
      nextUrl.searchParams.set("seats", JSON.stringify(selectedSeats));
    }
    // 가격 정보 전달
    nextUrl.searchParams.set("totalPrice", String(totalSelectedPrice));
    nextUrl.searchParams.set("fee", String(fee));
    nextUrl.searchParams.set("total", String(total));
    // 날짜/시간 정보 전달
    if (dateParam) nextUrl.searchParams.set("date", dateParam);
    if (timeParam) nextUrl.searchParams.set("time", timeParam);
    navigate(nextUrl.pathname + nextUrl.search);
  };

  return (
    <BookingLayout activeStep={2}>
      <div className="p-3 flex gap-3 h-full min-h-0">
        <div className="flex-1 bg-white rounded-md shadow border border-[#e3e3e3] flex flex-col min-h-0">
          <div className="px-3 py-2 text-sm border-b bg-[#fafafa]">
            {selectedSeatsText || "좌석을 선택해주세요."}
          </div>
          <div className="divide-y flex-1 overflow-y-auto min-h-0">
            {selectedSeats.map((seat, seatIndex) => (
              <div
                key={seat.grade}
                className={seatIndex > 0 ? "border-t-2 border-gray-300" : ""}
              >
                {/* 등급별 헤더 */}
                <div className="px-3 py-3 bg-gray-50 border-b">
                  <div className="font-semibold text-base text-gray-800">
                    {seat.grade} {seat.count}매
                  </div>
                </div>

                {/* 기본가 */}
                <Row
                  label={`기본가 (${seat.grade})`}
                  right={
                    <PriceCell
                      price={seat.price}
                      value={selections[seat.grade] === "base" ? seat.count : 0}
                      maxValue={seat.count}
                      onChange={(v) => {
                        setSelections((prev) => ({
                          ...prev,
                          [seat.grade]: v === seat.count ? "base" : null,
                        }));
                      }}
                    />
                  }
                />
                {/* 할인 옵션 */}
                {discounts.map((d, idx) => (
                  <Row
                    key={`${seat.grade}-${d.label}`}
                    label={`기본할인 (${seat.grade})`}
                    sub={d.label}
                    right={
                      <PriceCell
                        price={Math.round(seat.price * (1 - d.rate))}
                        value={selections[seat.grade] === idx ? seat.count : 0}
                        maxValue={seat.count}
                        onChange={(v) => {
                          setSelections((prev) => ({
                            ...prev,
                            [seat.grade]: v === seat.count ? idx : null,
                          }));
                        }}
                      />
                    }
                  />
                ))}
              </div>
            ))}
          </div>

          {/* 쿠폰 영역 */}
          <div className="px-3 py-2 text-[12px] text-gray-600 flex items-center justify-between border-t">
            <div>
              <span className="font-semibold text-gray-700">쿠폰할인</span>
              <span className="ml-2">(중복사용불가)</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded px-2 py-1 text-[12px] bg-[#e6f2ff] text-[#1e3a8a] border border-[#bcd3ff]">
                나의쿠폰모두보기
              </button>
              <button className="rounded px-2 py-1 text-[12px] border">
                쿠폰받기 ▾
              </button>
            </div>
          </div>
        </div>

        <aside className="w-64 space-y-3">
          <div className="bg-white rounded-md p-2 shadow border border-[#e3e3e3]">
            <div className="flex gap-3">
              {thumbnailSrc ? (
                <img
                  src={thumbnailSrc}
                  alt="방 썸네일"
                  className="w-24 h-32 object-cover rounded"
                  onError={(e) => {
                    // 이미지 로드 실패 시 플레이스홀더 표시
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const placeholder =
                      target.nextElementSibling as HTMLDivElement;
                    if (placeholder) {
                      placeholder.style.display = "block";
                    }
                  }}
                />
              ) : null}
              {!thumbnailSrc && (
                <div className="w-24 h-32 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">
                  방 썸네일
                </div>
              )}
              <div className="text-sm">
                <div className="font-bold">
                  {roomInfo.roomName || "방 이름"}
                </div>
                {roomInfo.startTime && (
                  <div className="text-[12px] mt-1 text-gray-500">
                    {dayjs(roomInfo.startTime).format("YYYY.MM.DD")}
                  </div>
                )}
                <div className="text-[12px] text-gray-500">
                  {roomInfo.hallName || "공연장 이름"}
                </div>
                <div className="text-[12px] text-gray-500">
                  Get your ticket!
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md p-3 shadow border border-[#e3e3e3]">
            <div className="text-sm font-semibold mb-2">My예매정보</div>
            <dl className="text-sm text-gray-700">
              <div className="flex py-1 border-b">
                <dt className="w-24 text-gray-500">일시</dt>
                <dd className="flex-1">
                  {formattedDateTime || "날짜/시간을 선택해주세요"}
                </dd>
              </div>
              <div className="flex py-1 border-b">
                <dt className="w-24 text-gray-500">선택좌석</dt>
                <dd className="flex-1">
                  {selectedSeatsSummary || "좌석을 선택해주세요"}
                </dd>
              </div>
              <div className="flex py-1">
                <dt className="w-24 text-gray-500">티켓금액</dt>
                <dd className="flex-1">
                  {totalSelectedPrice.toLocaleString()}원
                </dd>
              </div>
              <div className="flex py-1">
                <dt className="w-24 text-gray-500">수수료</dt>
                <dd className="flex-1">{fee.toLocaleString()}원</dd>
              </div>
              <div className="flex py-1">
                <dt className="w-24 text-gray-500">할인</dt>
                <dd className="flex-1">
                  {totalDiscountAmount > 0
                    ? `-${totalDiscountAmount.toLocaleString()}원`
                    : "-"}
                </dd>
              </div>
            </dl>

            <div className="mt-3 flex items-center justify-between bg-[#ececec] rounded px-3 py-2 border border-[#d9d9d9]">
              <div className="text-gray-800 font-bold">총 결제금액</div>
              <div className="font-extrabold">{total.toLocaleString()} 원</div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={goPrev}
                className="flex-1 bg-[#5a5a5a] hover:bg-[#4a4a4a] text-white rounded-md py-2 font-semibold"
              >
                이전단계
              </button>
              <button
                onClick={goNext}
                disabled={total === 0}
                className="flex-1 bg-[linear-gradient(to_bottom,#4383fb,#104bb7)] disabled:opacity-60 text-white rounded-md py-2 font-semibold"
              >
                다음단계 ▸
              </button>
            </div>
          </div>
        </aside>
      </div>
    </BookingLayout>
  );
}

function Row({
  label,
  sub,
  right,
}: {
  label: string;
  sub?: string;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-center border-b last:border-b-0">
      <div className="flex-1 py-3 px-3 text-sm">
        <div className="font-medium">{label}</div>
        {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
      </div>
      <div className="w-56 border-l bg-white">{right}</div>
    </div>
  );
}

function PriceCell({
  price,
  value,
  onChange,
  disabled,
  maxValue = 1,
}: {
  price: number;
  value: number;
  onChange?: (v: number) => void;
  disabled?: boolean;
  maxValue?: number;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-sm">
      <div className="text-gray-700">{price.toLocaleString()}원</div>
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange && onChange(Number(e.target.value))}
        className="border rounded px-2 py-1 text-sm"
        aria-label="count"
      >
        {Array.from({ length: maxValue + 1 }, (_, i) => (
          <option key={i} value={i}>
            {i}매
          </option>
        ))}
      </select>
    </div>
  );
}
