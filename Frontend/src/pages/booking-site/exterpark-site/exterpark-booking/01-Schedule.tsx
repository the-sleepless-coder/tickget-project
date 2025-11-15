import { useState, useMemo, useEffect } from "react";
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

// 썸네일 번호 -> 이미지 매핑
const THUMBNAIL_IMAGES: Record<string, string> = {
  "1": Thumbnail01,
  "2": Thumbnail02,
  "3": Thumbnail03,
  "4": Thumbnail04,
  "5": Thumbnail05,
  "6": Thumbnail06,
};

// hallId -> 공연장 이름 매핑
const HALL_ID_TO_NAME: Record<number, string> = {
  2: "샤롯데씨어터",
  3: "올림픽공원 올림픽홀",
  4: "인스파이어 아레나",
};

export default function BookingSelectSchedulePage() {
  const [searchParams] = useSearchParams();
  const hallId = searchParams.get("hallId");
  const roomInfo = useRoomStore((s) => s.roomInfo);
  const today = new Date();
  const todayDate = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // roomInfo의 startTime에서 기본 날짜/시간 추출
  const defaultDateTime = useMemo(() => {
    if (roomInfo.startTime) {
      try {
        // "2025-11-15T14:43:00" 형식 파싱
        const dateTime = new Date(roomInfo.startTime);
        if (!isNaN(dateTime.getTime())) {
          const year = dateTime.getFullYear();
          const month = dateTime.getMonth();
          const day = dateTime.getDate();
          const hour = String(dateTime.getHours()).padStart(2, "0");
          const minute = String(dateTime.getMinutes()).padStart(2, "0");
          return {
            date: new Date(year, month, day),
            time: `${hour}:${minute}`,
          };
        }
      } catch (error) {
        console.warn("[01-Schedule] startTime 파싱 실패:", error);
      }
    }
    return {
      date: new Date(currentYear, currentMonth, todayDate),
      time: "14:30",
    };
  }, [roomInfo.startTime, currentYear, currentMonth, todayDate]);

  // URL 파라미터에서 날짜와 시간 정보 가져오기
  const dateParam = searchParams.get("date");
  const timeParam = searchParams.get("time");
  const roundParam = searchParams.get("round");

  // 초기 날짜 설정 (URL 파라미터 우선, 없으면 startTime, 없으면 오늘)
  const getInitialDate = () => {
    if (dateParam) {
      try {
        const [year, month, day] = dateParam.split("-").map(Number);
        return new Date(year, month - 1, day);
      } catch (error) {
        console.warn("[01-Schedule] dateParam 파싱 실패:", error);
      }
    }
    return defaultDateTime.date;
  };

  const [selectedDate, setSelectedDate] = useState<Date>(getInitialDate());
  const [month, setMonth] = useState<number>(selectedDate.getMonth());
  const [year, setYear] = useState<number>(selectedDate.getFullYear());

  // 회차 목록 (startTime에서 추출한 시간 사용)
  const rounds = useMemo(
    () => [{ id: "1", label: "1회", time: defaultDateTime.time }],
    [defaultDateTime.time]
  );

  // 초기 회차 선택 (URL 파라미터의 time과 매칭되는 회차 선택)
  const getInitialRound = (roundsList: typeof rounds) => {
    if (roundParam) return roundParam;
    if (timeParam) {
      const matchingRound = roundsList.find((r) => r.time === timeParam);
      if (matchingRound) return matchingRound.id;
    }
    // timeParam이 없으면 startTime의 시간과 매칭되는 회차 선택
    const matchingRound = roundsList.find(
      (r) => r.time === defaultDateTime.time
    );
    return matchingRound?.id || null;
  };

  const [selectedRound, setSelectedRound] = useState<string | null>(() => {
    // 초기화 시점에 rounds를 계산
    const initialRounds = [
      { id: "1", label: "1회", time: defaultDateTime.time },
    ];
    return getInitialRound(initialRounds);
  });

  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const goPrev = () => navigate(paths.booking.waiting);
  const goNext = () => {
    if (!selectedDate || !selectedRound) return;
    const selectedRoundData = rounds.find((r) => r.id === selectedRound);
    const dateStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, "0")}-${selectedDate.getDate().toString().padStart(2, "0")}`;
    const timeStr = selectedRoundData?.time || defaultDateTime.time;
    const url = new URL(window.location.origin + paths.booking.selectSeat);
    url.searchParams.set("date", dateStr);
    url.searchParams.set("time", timeStr);
    url.searchParams.set("round", selectedRound);
    // hallId가 있으면 전달
    if (hallId) url.searchParams.set("hallId", hallId);
    navigate(url.pathname + url.search);
  };

  // URL 파라미터가 변경되면 날짜와 회차 업데이트
  useEffect(() => {
    if (dateParam) {
      try {
        const [year, month, day] = dateParam.split("-").map(Number);
        const newDate = new Date(year, month - 1, day);
        if (
          selectedDate.getFullYear() !== newDate.getFullYear() ||
          selectedDate.getMonth() !== newDate.getMonth() ||
          selectedDate.getDate() !== newDate.getDate()
        ) {
          setSelectedDate(newDate);
          setMonth(newDate.getMonth());
          setYear(newDate.getFullYear());
        }
      } catch (error) {
        console.warn("[01-Schedule] dateParam 파싱 실패:", error);
      }
    }
  }, [dateParam, selectedDate]);

  // timeParam이 변경되면 해당 시간과 매칭되는 회차 선택
  useEffect(() => {
    if (timeParam) {
      const matchingRound = rounds.find((r) => r.time === timeParam);
      if (matchingRound && selectedRound !== matchingRound.id) {
        setSelectedRound(matchingRound.id);
      }
    } else if (!selectedRound) {
      // timeParam이 없고 selectedRound도 없으면 기본 회차 선택
      const defaultRound = rounds.find((r) => r.time === defaultDateTime.time);
      if (defaultRound) {
        setSelectedRound(defaultRound.id);
      }
    }
  }, [timeParam, rounds, selectedRound, defaultDateTime.time]);

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

  // 썸네일 이미지 가져오기
  const thumbnailImage = roomInfo.thumbnailValue
    ? THUMBNAIL_IMAGES[roomInfo.thumbnailValue] || Thumbnail01
    : Thumbnail01;

  // 공연장 이름 가져오기
  const venueName = roomInfo.hallId
    ? HALL_ID_TO_NAME[roomInfo.hallId] ||
      roomInfo.hallName ||
      "공연장 정보 없음"
    : hallId
      ? HALL_ID_TO_NAME[Number(hallId)] || "공연장 정보 없음"
      : "공연장 정보 없음";

  // 날짜 포맷팅
  const formatDateRange = () => {
    if (!roomInfo.startTime) return "날짜 정보 없음";
    const date = dayjs(roomInfo.startTime);
    const dateStr = date.format("YYYY.MM.DD");
    return `${dateStr}`;
  };

  return (
    <BookingLayout activeStep={0}>
      <div className="p-3">
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
                          data-enabled-date={isAvailable ? "true" : undefined}
                          onClick={() => {
                            if (isAvailable) {
                              setSelectedDate(new Date(year, month, d));
                              setSelectedRound(null); // 날짜 변경 시 회차 초기화
                            }
                          }}
                          className={
                            "inline-flex items-center justify-center w-6 h-6 rounded text-xs " +
                            (isSelected
                              ? "bg-[#104bb7] text-white"
                              : isAvailable
                                ? "bg-[#60a5fa] text-white hover:bg-[#3b82f6]"
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
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#60a5fa]" />{" "}
                    예매 가능일
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#104bb7]" />{" "}
                    선택한 관람일
                  </div>
                </div>
              </div>

              {/* 회차 */}
              <div className="bg-white rounded-md shadow p-2 border border-[#e3e3e3]">
                <div className="text-sm font-bold mb-2">회차(관람시간)</div>
                <div className="h-[230px] rounded overflow-y-auto">
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
                              ? "border-[#104bb7] bg-[#eaf2ff] text-[#104bb7]"
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

              {/* 좌석등급/잔여석 - 내부 비어있음 */}
              <div className="bg-white rounded-md shadow p-2 border border-[#e3e3e3]">
                <div className="text-sm font-bold mb-2">좌석등급 / 잔여석</div>
                <div className="h-[230px] rounded overflow-y-auto">
                  {/* 빈칸 */}
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
                  src={thumbnailImage}
                  alt={roomInfo.roomName || "방 썸네일"}
                  className="w-20 h-28 object-cover rounded"
                />
                <div className="text-sm">
                  <div className="font-bold">
                    {roomInfo.roomName || "방 이름"}
                  </div>
                  {/* <div className="text-gray-600">{roomInfo.roomName || ""}</div> */}
                  <div className="text-[12px] mt-1 text-gray-500">
                    {formatDateRange()}
                  </div>
                  <div className="text-[12px] text-gray-500">{venueName}</div>
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
                    {selectedDate.getFullYear()}.
                    {(selectedDate.getMonth() + 1).toString().padStart(2, "0")}.
                    {selectedDate.getDate().toString().padStart(2, "0")} (
                    {
                      ["일", "월", "화", "수", "목", "금", "토"][
                        selectedDate.getDay()
                      ]
                    }
                    )
                    {selectedRound
                      ? ` ${rounds.find((r) => r.id === selectedRound)?.time || ""}`
                      : ""}
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
                  onClick={goNext}
                  disabled={!selectedDate || !selectedRound}
                  className="flex-1 bg-[linear-gradient(to_bottom,#4383fb,#104bb7)] hover:bg-[#104bb7] text-white rounded-md py-2 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300"
                >
                  다음단계 ▸
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BookingLayout>
  );
}
