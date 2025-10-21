import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Viewport from "../_components/Viewport";
import { paths } from "../../../app/routes/paths";

export default function BookingSelectSchedulePage() {
  const [selectedDay, setSelectedDay] = useState<number>(20);
  const navigate = useNavigate();
  const goPrev = () => navigate(paths.booking.waiting);
  const goNext = () => navigate(paths.booking.selectSeat);
  const days: (number | null)[] = [
    null,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    23,
    24,
    25,
    26,
    27,
    28,
    29,
    30,
    31,
    null,
    null,
    null,
  ];

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
              <div className="bg-white rounded-md shadow p-2 border border-[#e3e3e3]">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <button className="px-2 py-1 text-gray-500" aria-label="prev">
                    ‹
                  </button>
                  <div>2025년 12월</div>
                  <button className="px-2 py-1 text-gray-500" aria-label="next">
                    ›
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-7 text-center text-[11px] text-gray-600">
                  {"일월화수목금토".split("").map((d) => (
                    <div key={d} className="py-1 font-medium">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 text-center gap-y-1">
                  {days.map((d, i) => (
                    <div key={i} className="py-1">
                      {d ? (
                        <button
                          type="button"
                          onClick={() => setSelectedDay(d)}
                          className={
                            "inline-flex items-center justify-center w-7 h-7 rounded " +
                            (d === selectedDay
                              ? "bg-[#c62828] text-white"
                              : "hover:bg-gray-100")
                          }
                        >
                          {d}
                        </button>
                      ) : (
                        <span className="inline-block w-7 h-7" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-4 text-[12px] text-gray-600">
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-[#f6b26b]" />{" "}
                    예매 가능일
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-[#c62828]" />{" "}
                    선택한 관람일
                  </div>
                </div>
              </div>

              {/* 회차 */}
              <div className="bg-white rounded-md shadow p-2 border border-[#e3e3e3]">
                <div className="text-sm font-bold mb-2">회차(관람시간)</div>
                <div className="h-[230px] border rounded flex items-center justify-center text-gray-500 text-sm">
                  먼저 관람일을 선택해 주세요.
                </div>
              </div>

              {/* 좌석등급/잔여석 */}
              <div className="bg-white rounded-md shadow p-2 border border-[#e3e3e3]">
                <div className="text-sm font-bold mb-2">좌석등급 / 잔여석</div>
                <div className="h-[230px] border rounded flex items-center justify-center text-gray-500 text-sm">
                  회차 선택 후 확인 가능합니다.
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
                  <div className="font-bold">YB REMASTERED 3.0</div>
                  <div className="text-gray-600">Transcendent - 대구</div>
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
                  <dd className="flex-1">2025.12.{selectedDay} (토) 18:00</dd>
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
                  className="flex-1 bg-[#c62828] hover:bg-[#b71c1c] text-white rounded-md py-2 font-semibold"
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
