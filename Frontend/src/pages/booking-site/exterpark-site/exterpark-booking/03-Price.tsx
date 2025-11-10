import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BookingLayout from "./_components/BookingLayout";
import { paths } from "../../../../app/routes/paths";
import { useRoomStore } from "@features/room/store";
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
};

export default function PricePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomInfo = useRoomStore((s) => s.roomInfo);
  const fee = 2000;

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

    if (roomInfo.thumbnailType === "PRESET") {
      // PRESET인 경우 썸네일 번호로 이미지 선택
      return THUMBNAIL_IMAGES[roomInfo.thumbnailValue] || Thumbnail03;
    } else if (roomInfo.thumbnailType === "UPLOADED") {
      // UPLOADED인 경우 URL 직접 사용
      return roomInfo.thumbnailValue;
    } else {
      // thumbnailType이 없으면 thumbnailValue 형식으로 판단
      // 숫자 문자열이면 PRESET, 그렇지 않으면 UPLOADED
      if (/^\d+$/.test(roomInfo.thumbnailValue)) {
        return THUMBNAIL_IMAGES[roomInfo.thumbnailValue] || Thumbnail03;
      } else {
        return roomInfo.thumbnailValue;
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

  // 등급별 좌석 정보
  const seatsByGrade = useMemo(() => {
    return selectedSeats.reduce(
      (acc, seat) => {
        acc[seat.grade] = seat;
        return acc;
      },
      {} as Record<string, SeatData>
    );
  }, [selectedSeats]);

  // 총 좌석 수
  const totalSeatCount = useMemo(
    () => selectedSeats.reduce((sum, s) => sum + s.count, 0),
    [selectedSeats]
  );

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

  // 선택 좌석 요약 텍스트
  const selectedSeatsSummary = useMemo(() => {
    return selectedSeats.map((s) => `${s.grade} ${s.count}석`).join(", ");
  }, [selectedSeats]);

  const goPrev = () => navigate(paths.booking.selectSeat);
  const goNext = () => navigate(paths.booking.orderConfirm);

  return (
    <BookingLayout activeStep={2}>
      <div className="p-3 flex gap-3">
        <div className="flex-1 bg-white rounded-md shadow border border-[#e3e3e3]">
          <div className="px-3 py-2 text-sm border-b bg-[#fafafa]">
            {selectedSeatsText || "좌석을 선택해주세요."}
          </div>
          <div className="divide-y">
            {selectedSeats.map((seat) => (
              <div key={seat.grade}>
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
                  만 7세이상 • 120분
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
