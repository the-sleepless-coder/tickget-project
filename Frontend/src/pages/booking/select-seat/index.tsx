import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { paths } from "../../../app/routes/paths";
import {
  saveInitialReaction,
  setCaptchaEndNow,
  recordSeatCompleteNow,
} from "../../../shared/utils/reserveMetrics";
import Viewport from "../_components/Viewport";
import CaptchaModal from "../_components/CaptchaModal";
import SmallVenue from "../_components/venues/SmallVenue";
import MediumVenue from "../_components/venues/MediumVenue";
import LargeVenue from "../_components/venues/LargeVenue";

type GradeKey = "SR" | "R" | "S";
type SelectedSeat = {
  id: string;
  grade: GradeKey;
  label: string;
  price: number;
};

const GRADE_META: Record<
  GradeKey,
  { name: string; color: string; price: number }
> = {
  SR: { name: "SR석", color: "#6f53e3", price: 143000 },
  R: { name: "R석", color: "#3da14b", price: 132000 },
  S: { name: "S석", color: "#59b3ea", price: 110000 },
};

type VenueKind = "small" | "medium" | "large";

export default function SelectSeatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState<SelectedSeat[]>([]);
  const eventTitle = "방 이름 입력";
  const [showCaptcha, setShowCaptcha] = useState<boolean>(true);
  const [captchaBackspaces, setCaptchaBackspaces] = useState<number>(0);
  const [captchaWrongAttempts, setCaptchaWrongAttempts] = useState<number>(0);

  // venue 쿼리 처리 (small | medium | large)
  const venueParam = searchParams.get("venue");
  const venueKey: VenueKind =
    venueParam === "medium" || venueParam === "large" || venueParam === "small"
      ? venueParam
      : "small";
  const venueLabel =
    venueKey === "small"
      ? "소형 공연장"
      : venueKey === "medium"
        ? "중형 공연장"
        : "대형 공연장";

  // URL 파라미터에서 날짜와 시간 정보 가져오기
  const dateParam = searchParams.get("date");
  const timeParam = searchParams.get("time");
  const roundParam = searchParams.get("round");

  // 날짜 파싱
  const selectedDate = dateParam
    ? new Date(dateParam + "T00:00:00")
    : new Date();
  const selectedTime = timeParam || "14:30";

  // 선택 가능한 날짜 목록 생성 (오늘부터 2일 후까지)
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const availableDates: Date[] = [];
  for (let i = 0; i < 3; i++) {
    const date = new Date(todayStart);
    date.setDate(todayStart.getDate() + i);
    availableDates.push(date);
  }

  // 시간 포맷팅 (14:30 -> 14시 30분)
  const formatTime = (timeStr: string) => {
    const [hour, minute] = timeStr.split(":");
    return `${hour}시 ${minute}분`;
  };

  // 날짜 포맷팅
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
    return `${year}년 ${month}월 ${day}일(${weekday})`;
  };

  // 다른 날짜 선택 핸들러
  const handleDateChange = (dateStr: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("date", dateStr);
    navigate(url.pathname + url.search, { replace: true });
  };

  const totalPrice = useMemo(
    () => selected.reduce((sum, s) => sum + s.price, 0),
    [selected]
  );

  const clearSelection = () => setSelected([]);
  const goPrev = () => navigate(paths.booking.selectSchedule);
  const complete = () => {
    const durationSec = recordSeatCompleteNow();
    console.log("[ReserveTiming] Seat complete", {
      durationFromCaptchaSec: durationSec,
      captchaBackspaces,
      captchaWrongAttempts,
    });
    sessionStorage.setItem("reserve.capBackspaces", String(captchaBackspaces));
    sessionStorage.setItem("reserve.capWrong", String(captchaWrongAttempts));
    const nextUrl = new URL(window.location.origin + paths.booking.price);
    if (durationSec != null)
      nextUrl.searchParams.set("capToCompleteSec", String(durationSec));
    nextUrl.searchParams.set("capBackspaces", String(captchaBackspaces));
    nextUrl.searchParams.set("capWrong", String(captchaWrongAttempts));
    const rt =
      searchParams.get("rtSec") ?? sessionStorage.getItem("reserve.rtSec");
    const nrc =
      searchParams.get("nrClicks") ??
      sessionStorage.getItem("reserve.nrClicks");
    if (rt) nextUrl.searchParams.set("rtSec", rt);
    if (nrc) nextUrl.searchParams.set("nrClicks", nrc);
    const cap = sessionStorage.getItem("reserve.captchaDurationSec");
    if (cap) nextUrl.searchParams.set("captchaSec", cap);
    // 날짜와 회차 정보 전달
    if (dateParam) nextUrl.searchParams.set("date", dateParam);
    if (timeParam) nextUrl.searchParams.set("time", timeParam);
    if (roundParam) nextUrl.searchParams.set("round", roundParam);
    navigate(nextUrl.pathname + nextUrl.search);
  };

  useEffect(() => {
    const rtSec = searchParams.get("rtSec");
    const nrClicks = searchParams.get("nrClicks");
    console.log("[ReserveTiming] Captcha input stage", {
      reactionSec: rtSec ? Number(rtSec) : null,
      nonReserveClickCount: nrClicks ? Number(nrClicks) : null,
    });
    saveInitialReaction(rtSec, nrClicks);
  }, [searchParams]);

  return (
    <Viewport>
      <CaptchaModal
        open={showCaptcha}
        onVerify={(durationMs, { backspaceCount, wrongAttempts }) => {
          const sec = Math.round(durationMs) / 1000;
          setCaptchaBackspaces(backspaceCount);
          setCaptchaWrongAttempts(wrongAttempts);
          setCaptchaEndNow(sec, backspaceCount, wrongAttempts);
          console.log("[ReserveTiming] Captcha verified", {
            captchaSec: sec,
            backspaceCount,
            wrongAttempts,
          });
          setShowCaptcha(false);
        }}
        onReselect={goPrev}
      />
      {/* 상단: 좌석 선택 헤더 (스샷 유사 스타일) */}
      <div className="bg-[linear-gradient(to_bottom,#f2f2f2,#dbdbdb)] border-b border-[#bdbdbd]">
        <div className="max-w-5xl mx-auto px-2 py-2 flex items-center gap-3">
          <div className="flex items-center bg-[#b02a2a] text-white rounded-none border border-[#8f1c1c] px-3 h-7 shadow-inner">
            <span className="bg-[#ffcc33] text-[#222] font-extrabold text-[11px] rounded-full w-6 h-6 flex items-center justify-center mr-2">
              02
            </span>
            <span className="text-sm font-bold">좌석 선택</span>
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-[#222]">
              {eventTitle}
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[#555] mt-1">
              <span>› 다른 관람일자 선택 :</span>
              <label htmlFor="dateSel" className="sr-only">
                일자
              </label>
              <select
                id="dateSel"
                className="border border-[#cfcfcf] rounded px-1 py-0.5 bg-white"
                value={
                  dateParam ||
                  `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, "0")}-${selectedDate.getDate().toString().padStart(2, "0")}`
                }
                onChange={(e) => handleDateChange(e.target.value)}
              >
                {availableDates.map((date) => {
                  const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
                  return (
                    <option key={dateStr} value={dateStr}>
                      {formatDate(date)}
                    </option>
                  );
                })}
              </select>
              <span>시간</span>
              <label htmlFor="timeSel" className="sr-only">
                시간
              </label>
              <select
                id="timeSel"
                className="border border-[#cfcfcf] rounded px-1 py-0.5 bg-white"
                value={selectedTime}
                disabled
              >
                <option value={selectedTime}>{formatTime(selectedTime)}</option>
              </select>
            </div>
          </div>
          <div>
            <button className="text-[11px] bg-[#f5f5f5] border border-[#cfcfcf] rounded px-2 py-1 text-[#777]">
              예매대기
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[920px] mx-auto p-3 flex gap-3">
        {/* 좌측: 좌석도 */}
        <div className="flex-1 bg-white rounded-md shadow p-3 border border-[#e3e3e3]">
          <div className="text-[12px] text-gray-600 border rounded px-3 py-2 bg-[#fafafa]">
            {venueLabel}이(가) 선택되었습니다. 좌석 블록은 추후 추가됩니다.
          </div>

          <div className="mt-3 grid grid-cols-[120px_1fr] gap-3">
            {/* 왼쪽 안내 */}
            <div className="space-y-2 text-[12px] text-gray-700">
              <div className="border p-2">
                <div className="font-semibold mb-1">구역이미지</div>
                <div className="h-16 bg-[repeating-linear-gradient(90deg,#9aa7,0, #9aa7 6px, #fff 6px, #fff 10px)]" />
              </div>
              <div className="bg-[#fff3f3] border border-[#e5bcbc] p-2 leading-5">
                구역내 상단이 무대와 가까운 쪽입니다.
                <div className="text-[11px] text-gray-600">
                  The upper end of the section is the closest area to the stage.
                </div>
              </div>
              <div className="bg-[#5c2121] text-white text-[12px] p-2 rounded">
                ※ 가로로(한줄로 나란히) 예매해 주세요.
              </div>
            </div>

            {/* 공연장 프리셋 컴포넌트만 렌더 */}
            <div>
              {venueKey === "small" && <SmallVenue />}
              {venueKey === "medium" && <MediumVenue />}
              {venueKey === "large" && <LargeVenue />}
            </div>
          </div>
        </div>

        {/* 우측: 사이드 정보 */}
        <aside className="w-80 space-y-3">
          <div className="bg-white rounded-md border border-[#e3e3e3] shadow">
            <div className="px-3 py-2 bg-[#b02a2a] text-white font-bold rounded-t-md flex items-center justify-between">
              <span>좌석도 전체보기</span>
              <span>▶</span>
            </div>
            <div className="p-2 text-sm">
              <div className="font-semibold mb-2">좌석등급 / 잔여석</div>
              <ul className="space-y-1">
                {/** 데모이므로 잔여석 수치는 임의 표기 */}
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ background: GRADE_META.SR.color }}
                    />{" "}
                    SR석 1,820석
                  </div>
                  <div className="text-gray-700">
                    {GRADE_META.SR.price.toLocaleString()}원
                  </div>
                </li>
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ background: GRADE_META.R.color }}
                    />{" "}
                    R석 752석
                  </div>
                  <div className="text-gray-700">
                    {GRADE_META.R.price.toLocaleString()}원
                  </div>
                </li>
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ background: GRADE_META.S.color }}
                    />{" "}
                    S석 436석
                  </div>
                  <div className="text-gray-700">
                    {GRADE_META.S.price.toLocaleString()}원
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-md border border-[#e3e3e3] shadow">
            <div className="px-3 py-2 text-[#b02a2a] text-right text-sm border-b">
              총 {selected.length}석 선택되었습니다.
            </div>
            <div className="p-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left font-normal w-24 whitespace-nowrap">
                      좌석등급
                    </th>
                    <th className="text-left font-normal whitespace-nowrap">
                      좌석번호
                    </th>
                    <th className="text-right font-normal w-16 whitespace-nowrap">
                      삭제
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="text-center text-gray-400 py-8"
                      >
                        선택된 좌석이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    selected.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="py-2 whitespace-nowrap">
                          {GRADE_META[s.grade].name}
                        </td>
                        <td className="whitespace-nowrap">{s.label}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setSelected((prev) =>
                                prev.filter((x) => x.id !== s.id)
                              )
                            }
                            className="inline-flex items-center justify-center w-7 h-7 rounded border border-[#e0e0e0] text-gray-500 hover:bg-[#f6f6f6]"
                            aria-label={`remove-${s.id}`}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <button
                disabled={selected.length === 0}
                onClick={complete}
                className="mt-3 w-full py-3 rounded font-bold bg-[#c62828] text-white hover:bg-[#b71c1c] disabled:hover:bg-[#c62828] disabled:cursor-not-allowed"
              >
                좌석선택완료 ▸
              </button>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <button
                  onClick={goPrev}
                  className="flex-1 border rounded px-2 py-2 bg-[#f4f4f4] hover:bg-[#ececec]"
                >
                  이전단계
                </button>
                <button
                  onClick={clearSelection}
                  className="flex-1 border rounded px-2 py-2 bg-[#f4f4f4] hover:bg-[#ececec]"
                >
                  좌석 다시 선택
                </button>
              </div>
              <div className="mt-2 text-[12px] text-[#b02a2a]">
                ※ 좌석 선택시 유의사항
              </div>
            </div>
            <div className="px-3 py-2 text-right text-sm border-t bg-[#fafafa]">
              합계:{" "}
              <span className="font-semibold">
                {totalPrice.toLocaleString()}원
              </span>
            </div>
          </div>
        </aside>
      </div>
    </Viewport>
  );
}
