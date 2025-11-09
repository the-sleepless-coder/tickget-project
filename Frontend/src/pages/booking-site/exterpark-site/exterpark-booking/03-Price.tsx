import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BookingLayout from "./_components/BookingLayout";
import { paths } from "../../../../app/routes/paths";

export default function PricePage() {
  const navigate = useNavigate();
  const basePrice = 143000;
  const fee = 2000;
  const discounts = useMemo(
    () => [
      { label: "중중장애인(1~3급/동반1인)20%", rate: 0.2 },
      { label: "경증장애인(4~6급/본인만)20%", rate: 0.2 },
      { label: "국가 유공자(본인만)20%", rate: 0.2 },
    ],
    []
  );

  // 선택 상태: 기본가("base") 또는 할인 인덱스(0..n-1) 또는 null(미선택)
  const [selection, setSelection] = useState<"base" | number | null>("base");

  const selectedPrice = useMemo(() => {
    if (selection === "base") return basePrice;
    if (typeof selection === "number")
      return Math.round(basePrice * (1 - discounts[selection].rate));
    return 0;
  }, [selection, basePrice, discounts]);

  const discountAmount = useMemo(() => {
    if (selection === null || selection === "base") return 0;
    return basePrice - selectedPrice;
  }, [selection, basePrice, selectedPrice]);

  const total = useMemo(
    () => (selectedPrice > 0 ? selectedPrice + fee : 0),
    [selectedPrice, fee]
  );

  const goPrev = () => navigate(paths.booking.selectSeat);
  const goNext = () => navigate(paths.booking.orderConfirm);

  return (
    <BookingLayout activeStep={2}>
      <div className="p-3 flex gap-3">
        <div className="flex-1 bg-white rounded-md shadow border border-[#e3e3e3]">
          <div className="px-3 py-2 text-sm border-b bg-[#fafafa]">
            SR석 | 좌석 1매를 선택하셨습니다.
          </div>
          <div className="divide-y">
            <Row
              label="기본가"
              right={
                <PriceCell
                  price={basePrice}
                  value={selection === "base" ? 1 : 0}
                  onChange={(v) => setSelection(v === 1 ? "base" : null)}
                />
              }
            />
            {discounts.map((d, idx) => (
              <Row
                key={d.label}
                label={`기본할인`}
                sub={d.label}
                right={
                  <PriceCell
                    price={Math.round(basePrice * (1 - d.rate))}
                    value={selection === idx ? 1 : 0}
                    onChange={(v) => setSelection(v === 1 ? idx : null)}
                  />
                }
              />
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
              <div className="w-24 h-32 bg-gray-200 rounded" />
              <div className="text-sm">
                <div className="font-bold">방 이름1</div>
                <div className="text-gray-600">방 이름2</div>
                <div className="text-[12px] mt-1 text-gray-500">
                  2025.12.20 ~ 2025.12.20
                </div>
                <div className="text-[12px] text-gray-500">엑스코 서관 1홀</div>
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
                <dd className="flex-1">2025.12.20 (토) 18:00</dd>
              </div>
              <div className="flex py-1 border-b">
                <dt className="w-24 text-gray-500">선택좌석</dt>
                <dd className="flex-1">SR석 1석</dd>
              </div>
              <div className="flex py-1">
                <dt className="w-24 text-gray-500">티켓금액</dt>
                <dd className="flex-1">{selectedPrice.toLocaleString()}원</dd>
              </div>
              <div className="flex py-1">
                <dt className="w-24 text-gray-500">수수료</dt>
                <dd className="flex-1">{fee.toLocaleString()}원</dd>
              </div>
              <div className="flex py-1">
                <dt className="w-24 text-gray-500">할인</dt>
                <dd className="flex-1">
                  {discountAmount > 0
                    ? `-${discountAmount.toLocaleString()}원`
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
}: {
  price: number;
  value: number;
  onChange?: (v: number) => void;
  disabled?: boolean;
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
        <option value={0}>0매</option>
        <option value={1}>1매</option>
      </select>
    </div>
  );
}
