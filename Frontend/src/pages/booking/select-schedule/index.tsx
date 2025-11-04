import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Viewport from "../_components/Viewport";
import { paths } from "../../../app/routes/paths";

export default function BookingSelectSchedulePage() {
  const today = new Date();
  const todayDate = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const [selectedDate, setSelectedDate] = useState<Date>(
    new Date(currentYear, currentMonth, todayDate)
  );
  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const [month, setMonth] = useState<number>(currentMonth);
  const [year, setYear] = useState<number>(currentYear);
  const navigate = useNavigate();
  const goPrev = () => navigate(paths.booking.waiting);
  const goNext = () => {
    if (!selectedDate || !selectedRound) return;
    const selectedRoundData = rounds.find((r) => r.id === selectedRound);
    const dateStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, "0")}-${selectedDate.getDate().toString().padStart(2, "0")}`;
    const timeStr = selectedRoundData?.time || "14:30";
    const url = new URL(window.location.origin + paths.booking.selectSeat);
    url.searchParams.set("date", dateStr);
    url.searchParams.set("time", timeStr);
    url.searchParams.set("round", selectedRound);
    navigate(url.pathname + url.search);
  };

  // 회차 목록 (날짜 선택 시 표시)
  const rounds = [{ id: "1", label: "1회", time: "14:30" }];

  // 달력 날짜 생성
  const monthStart = new Date(year, month, 1);
  const startDay = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];

  // 첫 주 빈 칸 채우기
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }

  // 실제 날짜들
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  // 마지막 주 빈 칸 채우기 (7의 배수가 되도록)
  const remaining = 7 - (days.length % 7);
  if (remaining !== 7) {
    for (let i = 0; i < remaining; i++) {
      days.push(null);
    }
  }

  // 날짜가 활성화 가능한지 확인
  const isDateAvailable = (day: number): boolean => {
    const dateObj = new Date(year, month, day);
    const todayStart = new Date(currentYear, currentMonth, todayDate);
    const maxAvailableDate = new Date(currentYear, currentMonth, todayDate + 2);
    return dateObj >= todayStart && dateObj <= maxAvailableDate;
  };

  const monthLabel = `${year}년 ${month + 1}월`;

  const changeMonth = (delta: number) => {
    const newDate = new Date(year, month + delta, 1);
    setYear(newDate.getFullYear());
    setMonth(newDate.getMonth());
  };

  return (
    <Viewport>
      {/* 상단 단계 네비게이션 바 (옅은 그라데이션 회색) */}
      <div className="text-[#222] bg-[linear-gradient(to_bottom,#f7f7f7,#e2e2e2)] border-b border-[#cfcfcf]">
        <div className="mx-auto flex text-[13px] max-w-[860px] py-2">
          {[
            "01 관람일/회차선택",
            "02 좌석 선택",
            "03 가격/할인선택",
            "04 배송선택/주문자확인",
            "05 결제하기",
          ].map((t, i) => (
            <div
              key={t}
              className={
                "px-4 py-3 border-r border-[#c7c7c7] flex items-center gap-2 " +
                (i === 0
                  ? "bg-[#c62828] text-white"
                  : "bg-[#d9d9d9] text-[#333]")
              }
            >
              <span className="font-extrabold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-semibold">
                {t.replace(/^[0-9]{2}\s/, "")}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-[860px] mx-auto p-3">
        <div className="flex gap-4">
          {/* 좌측 3분할: 달력 / 회차 / 좌석등급 */}
          <div className="flex-1">
            <div className="grid grid-cols-3 gap-2">
              {/* 달력 */}
              <div className="bg-white rounded-md shadow p-1.5 border border-[#e3e3e3]">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <button
                    className="px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 rounded"
                    aria-label="prev"
                    onClick={() => changeMonth(-1)}
                  >
                    ‹
                  </button>
                  <div>{monthLabel}</div>
                  <button
                    className="px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 rounded"
                    aria-label="next"
                    onClick={() => changeMonth(1)}
                  >
                    ›
                  </button>
                </div>
                <div className="mt-1.5 grid grid-cols-7 text-center text-[10px] text-gray-600">
                  {"일월화수목금토".split("").map((d) => (
                    <div key={d} className="py-0.5 font-medium">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 text-center gap-y-0.5">
                  {days.map((d, i) => {
                    if (!d) {
                      return (
                        <div key={i} className="py-0.5">
                          <span className="inline-block w-6 h-6" />
                        </div>
                      );
                    }

                    const isAvailable = isDateAvailable(d);
                    const isSelected =
                      selectedDate.getFullYear() === year &&
                      selectedDate.getMonth() === month &&
                      selectedDate.getDate() === d;

                    return (
                      <div key={i} className="py-0.5">
                        <button
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => {
                            if (isAvailable) {
                              setSelectedDate(new Date(year, month, d));
                              setSelectedRound(null); // 날짜 변경 시 회차 초기화
                            }
                          }}
                          className={
                            "inline-flex items-center justify-center w-6 h-6 rounded text-xs " +
                            (isSelected
                              ? "bg-[#c62828] text-white"
                              : isAvailable
                                ? "bg-[#f6b26b] text-white hover:bg-[#f5a352]"
                                : "text-gray-300 cursor-not-allowed pointer-events-none")
                          }
                        >
                          {d}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-600">
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#f6b26b]" />{" "}
                    예매 가능일
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#c62828]" />{" "}
                    선택한 관람일
                  </div>
                </div>
              </div>

              {/* 회차 */}
              <div className="bg-white rounded-md shadow p-2 border border-[#e3e3e3]">
                <div className="text-sm font-bold mb-2">회차(관람시간)</div>
                <div className="h-[230px] border rounded overflow-y-auto">
                  {selectedDate ? (
                    <div className="p-2 space-y-2">
                      {rounds.map((round) => (
                        <button
                          key={round.id}
                          type="button"
                          onClick={() => setSelectedRound(round.id)}
                          className={
                            "w-full text-left p-2 rounded border text-xs transition-colors " +
                            (selectedRound === round.id
                              ? "border-[#c62828] bg-red-50 text-[#c62828]"
                              : "border-gray-200 hover:bg-gray-50")
                          }
                        >
                          <div className="font-semibold">{round.label}</div>
                          <div className="text-gray-600 text-[11px]">
                            {round.time}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                      먼저 관람일을 선택해 주세요.
                    </div>
                  )}
                </div>
              </div>

              {/* 좌석등급/잔여석 */}
              <div className="bg-white rounded-md shadow p-2 border border-[#e3e3e3]">
                <div className="text-sm font-bold mb-2">좌석등급 / 잔여석</div>
                <div className="h-[230px] border rounded overflow-y-auto">
                  {selectedRound ? (
                    <div className="p-2 space-y-2">
                      <div className="p-2 border rounded text-xs">
                        <div className="font-semibold mb-1">R석</div>
                        <div className="text-gray-600 text-[11px]">
                          잔여석: 147석
                        </div>
                      </div>
                      <div className="p-2 border rounded text-xs">
                        <div className="font-semibold mb-1">S석</div>
                        <div className="text-gray-600 text-[11px]">
                          잔여석: 134석
                        </div>
                      </div>
                      <div className="p-2 border rounded text-xs">
                        <div className="font-semibold mb-1">A석</div>
                        <div className="text-gray-600 text-[11px]">
                          잔여석: 224석
                        </div>
                      </div>
                      <div className="p-2 border rounded text-xs">
                        <div className="font-semibold mb-1">B석</div>
                        <div className="text-gray-600 text-[11px]">
                          잔여석: 288석
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                      회차 선택 후 확인 가능합니다.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 유의사항 */}
            <div className="mt-3 bg-white rounded-md shadow p-3 border border-[#e3e3e3]">
              <div className="font-semibold text-sm mb-2">유의사항</div>
              <ul className="text-[12px] text-gray-600 list-disc pl-4 space-y-1">
                <li>
                  장애인, 국가유공자 할인은 현장 증빙서류 확인 시에만
                  가능합니다.
                </li>
                <li>할인쿠폰 사용하여 예매한 티켓은 부분취소가 불가합니다.</li>
                <li>당일 관람 상품에서는 취소가 불가합니다.</li>
                <li>
                  수수료 및 취소수수료는 상품별로 상이합니다. My예매정보를
                  확인해주세요.
                </li>
                <li>무통장 입금이 어려울 경우 다른 결제수단을 선택해주세요.</li>
              </ul>
            </div>
          </div>

          {/* 우측: 포스터 + My예매정보 카드 */}
          <div className="w-60 space-y-3">
            <div className="bg-white rounded-md p-2 shadow border border-[#e3e3e3]">
              <div className="flex gap-3">
                <img
                  src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop"
                  alt="poster"
                  className="w-20 h-28 object-cover rounded"
                />
                <div className="text-sm">
                  <div className="font-bold">방 이름1</div>
                  <div className="text-gray-600">방 이름2</div>
                  <div className="text-[12px] mt-1 text-gray-500">
                    2025.12.20 ~ 2025.12.20
                  </div>
                  <div className="text-[12px] text-gray-500">
                    엑스코 서관 1홀
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
                    {selectedDate.getFullYear()}.
                    {(selectedDate.getMonth() + 1).toString().padStart(2, "0")}.
                    {selectedDate.getDate().toString().padStart(2, "0")} (
                    {
                      ["일", "월", "화", "수", "목", "금", "토"][
                        selectedDate.getDay()
                      ]
                    }
                    ){" "}
                    {selectedRound
                      ? rounds.find((r) => r.id === selectedRound)?.time ||
                        "18:00"
                      : "18:00"}
                  </dd>
                </div>
                <div className="flex py-1 border-b">
                  <dt className="w-24 text-gray-500">선택좌석</dt>
                  <dd className="flex-1">0석</dd>
                </div>
                <div className="flex py-1">
                  <dt className="w-24 text-gray-500">티켓금액</dt>
                  <dd className="flex-1">-</dd>
                </div>
                <div className="flex py-1">
                  <dt className="w-24 text-gray-500">수수료</dt>
                  <dd className="flex-1">-</dd>
                </div>
                <div className="flex py-1">
                  <dt className="w-24 text-gray-500">배송료</dt>
                  <dd className="flex-1">-</dd>
                </div>
                <div className="flex py-1">
                  <dt className="w-24 text-gray-500">할인</dt>
                  <dd className="flex-1">-</dd>
                </div>

                <div className="flex items-center justify-between mt-3 bg-[#ececec] rounded px-3 py-2 border border-[#d9d9d9]">
                  <dt className="text-gray-800 font-bold">총 결제금액</dt>
                  <dd className="font-extrabold">0 원</dd>
                </div>
              </dl>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={goPrev}
                  className="flex-1 bg-[#5a5a5a] hover:bg-[#4a4a4a] text-white rounded-md py-2 font-semibold"
                >
                  이전단계
                </button>
                <button
                  onClick={goNext}
                  disabled={!selectedDate || !selectedRound}
                  className="flex-1 bg-[#c62828] hover:bg-[#b71c1c] text-white rounded-md py-2 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300"
                >
                  다음단계 ▸
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Viewport>
  );
}
