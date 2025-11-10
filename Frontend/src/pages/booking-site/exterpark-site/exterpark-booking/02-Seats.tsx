import {
  useEffect,
  useMemo,
  useState,
  useRef,
  type CSSProperties,
} from "react";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRoomStore } from "@features/room/store";
import { paths } from "../../../../app/routes/paths";
import {
  saveInitialReaction,
  setCaptchaEndNow,
  recordSeatCompleteNow,
} from "../../../../shared/utils/reserveMetrics";
import Viewport from "./_components/Viewport";
import SeatGrades from "./_components/Side_Grades";
import SeatSidebarBanner from "./_components/Side_Banner";
import CaptchaModal from "./_components/CaptchaModal";
import SmallVenue from "../../../performance-halls/small-venue/CharlotteTheater";
import MediumVenue, {
  type MediumVenueRef,
} from "../../../performance-halls/medium-venue/OlympicHall";
import LargeVenue, {
  type LargeVenueRef,
} from "../../../performance-halls/large-venue/InspireArena";

type GradeKey = "SR" | "R" | "S" | "A" | "STANDING";
type SelectedSeat = {
  id: string;
  gradeLabel: string;
  label: string;
  price?: number;
};

const GRADE_META: Record<
  GradeKey,
  { name: string; color: string; price: number }
> = {
  SR: { name: "VIP석", color: "#6f53e3", price: 143000 },
  R: { name: "R석", color: "#3da14b", price: 132000 },
  S: { name: "S석", color: "#59b3ea", price: 110000 },
  A: { name: "A석", color: "#FB7E4E", price: 80000 },
  STANDING: { name: "스탠딩석", color: "#9ca3af", price: 170000 },
};

// 등급 레이블로 가격 찾기
const getPriceByGradeLabel = (gradeLabel: string): number => {
  // "스탠딩석", "VIP석", "R석", "S석", "A석", "SR석" 등
  if (gradeLabel.includes("스탠딩")) return GRADE_META.STANDING.price;
  if (gradeLabel.includes("VIP")) return GRADE_META.SR.price; // VIP석 = SR석 가격
  if (gradeLabel.includes("R석")) return GRADE_META.R.price;
  if (gradeLabel.includes("S석")) return GRADE_META.S.price;
  if (gradeLabel.includes("A석")) return GRADE_META.A.price;
  if (gradeLabel.includes("SR석")) return GRADE_META.SR.price;
  // 기본값
  return GRADE_META.S.price;
};

type VenueKind = "small" | "medium" | "large";

export default function SelectSeatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState<SelectedSeat[]>([]);
  const roomInfo = useRoomStore((s) => s.roomInfo);
  const eventTitle = roomInfo.roomName || "방 이름 입력";
  const venueName = roomInfo.hallName || "공연장 이름";
  const captchaPassed = useRoomStore((s) => s.roomInfo.captchaPassed);
  const setCaptchaPassed = useRoomStore((s) => s.setCaptchaPassed);
  // captchaPassed가 false일 때만 캡챠 표시
  const [showCaptcha, setShowCaptcha] = useState<boolean>(!captchaPassed);
  const [captchaBackspaces, setCaptchaBackspaces] = useState<number>(0);
  const [captchaWrongAttempts, setCaptchaWrongAttempts] = useState<number>(0);

  // captchaPassed 상태가 변경되면 showCaptcha 업데이트
  useEffect(() => {
    setShowCaptcha(!captchaPassed);
  }, [captchaPassed]);
  const mediumVenueRef = useRef<MediumVenueRef | null>(null);
  const largeVenueRef = useRef<LargeVenueRef | null>(null);

  // hallId 기반 venue 결정
  // hallId 2: 샤롯데씨어터 (small)
  // hallId 3: 올림픽 홀 (medium)
  // hallId 4: 인스파이어 아레나 (large)
  const hallIdParam = searchParams.get("hallId");
  const hallIdFromStore = useRoomStore((s) => s.roomInfo.hallId);
  const hallId = hallIdParam ? Number(hallIdParam) : (hallIdFromStore ?? null);

  // hallId를 venue로 변환
  const getVenueFromHallId = (id: number | null): VenueKind => {
    if (id === 2) return "small"; // 샤롯데씨어터
    if (id === 3) return "medium"; // 올림픽 홀
    if (id === 4) return "large"; // 인스파이어 아레나
    return "small"; // 기본값
  };

  // 기존 venue 쿼리 파라미터도 지원 (하위 호환성)
  const venueParam = searchParams.get("venue");
  const venueKey: VenueKind = hallId
    ? getVenueFromHallId(hallId)
    : venueParam === "medium" ||
        venueParam === "large" ||
        venueParam === "small"
      ? venueParam
      : "small";

  // URL 파라미터에서 날짜와 시간 정보 가져오기
  const dateParam = searchParams.get("date") || "";
  const timeParam = searchParams.get("time") || "";
  const roundParam = searchParams.get("round");

  // 선택 가능한 날짜 목록 생성 (오늘부터 3일)
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

  // 요일에 따른 드롭다운 option 색상 (토: 파란색, 일: 빨간색)
  const getDateOptionStyle = (date: Date): CSSProperties => {
    const day = date.getDay(); // 0: 일요일, 6: 토요일
    if (day === 0) return { color: "#d32f2f" }; // 일요일: 빨간색
    if (day === 6) return { color: "#1e3a8a" }; // 토요일: 파란색
    return {};
  };

  // 시간 목록 (현재 14:30 하나만 노출)
  const availableTimes: string[] = ["14:30"];

  // 시간 placeholder 라벨
  const timePlaceholderLabel = "선택하세요!";
  // 좌석 클릭 차단 여부 (둘 중 하나라도 비어있으면 차단)
  const isSeatBlocked = dateParam === "" || timeParam === "";

  // 선택된 날짜 기준으로 시간 옵션 색상 지정 (토: 파랑, 일: 빨강)
  const getTimeOptionStyle = (): CSSProperties => {
    if (!dateParam) return {};
    const d = new Date(dateParam + "T00:00:00");
    const day = d.getDay(); // 0: 일, 6: 토
    if (day === 0) return { color: "#d32f2f" };
    if (day === 6) return { color: "#1e3a8a" };
    return {};
  };
  // 다른 날짜 선택 핸들러
  const handleDateChange = (dateStr: string) => {
    const url = new URL(window.location.href);
    if (dateStr === "") {
      url.searchParams.delete("date");
      // 일자 placeholder를 선택하면 시간도 placeholder로 초기화
      url.searchParams.delete("time");
    } else {
      url.searchParams.set("date", dateStr);
    }
    navigate(url.pathname + url.search, { replace: true });
  };

  // 시간 선택 핸들러
  const handleTimeChange = (timeStr: string) => {
    const url = new URL(window.location.href);
    if (timeStr === "") url.searchParams.delete("time");
    else url.searchParams.set("time", timeStr);
    navigate(url.pathname + url.search, { replace: true });
  };

  // 좌석 차단 시 현재 선택 좌석 초기화
  useEffect(() => {
    if (isSeatBlocked) {
      setSelected((prev) => (prev.length > 0 ? [] : prev));
    }
  }, [isSeatBlocked]);

  const totalPrice = useMemo(
    () => selected.reduce((sum, s) => sum + (s.price ?? 0), 0),
    [selected]
  );

  const clearSelection = () => setSelected([]);
  const goPrev = () => {
    const url = new URL(window.location.origin + paths.booking.selectSchedule);
    // hallId가 있으면 전달
    if (hallId) url.searchParams.set("hallId", String(hallId));
    navigate(url.pathname + url.search);
  };
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
    // 선택한 좌석 정보 전달 (등급별로 그룹화)
    const seatsByGrade = selected.reduce(
      (acc, seat) => {
        const grade = seat.gradeLabel;
        if (!acc[grade]) {
          acc[grade] = { count: 0, price: seat.price ?? 0 };
        }
        acc[grade].count += 1;
        return acc;
      },
      {} as Record<string, { count: number; price: number }>
    );
    const seatsData = Object.entries(seatsByGrade).map(([grade, data]) => ({
      grade,
      count: data.count,
      price: data.price,
    }));
    if (seatsData.length > 0) {
      nextUrl.searchParams.set("seats", JSON.stringify(seatsData));
    }
    navigate(nextUrl.pathname + nextUrl.search);
  };

  useEffect(() => {
    // 팝업 크기 보정만 수행 (스크롤은 숨기지 않음)
    if (typeof window.resizeTo === "function") {
      window.resizeTo(920, 750);
    }

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
          // 캡챠 통과 시 room store에 true로 저장
          setCaptchaPassed(true);
          console.log("[ReserveTiming] Captcha verified", {
            captchaSec: sec,
            backspaceCount,
            wrongAttempts,
          });
          setShowCaptcha(false);
        }}
        onReselect={goPrev}
      />
      {/* 고정 레이아웃 컨테이너: 전체 900 x 670 */}
      <div className="mx-auto w-[880px] h-[670px]">
        {/* 헤더 900 x 50 */}
        <div className="w-[880px] h-[50px] bg-[linear-gradient(to_bottom,#f2f2f2,#dbdbdb)] border-b border-[#bdbdbd]">
          <div className="h-full flex items-center gap-3">
            <div className="flex items-center bg-[linear-gradient(to_bottom,#4383fb,#104bb7)] text-white rounded-none px-12 h-12.5">
              <span className="text-[#ffcc33] font-extrabold text-[18px] rounded-full w-6 h-6 flex items-center justify-center mr-2">
                02/
              </span>
              <span className="text-md font-semibold">좌석 선택</span>
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-bold text-[#222]">
                {eventTitle}
                <span className="text-[12px] text-gray-400 ml-5">
                  | {venueName}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[#555]">
                <span>› 다른 관람일자 선택 :</span>
                <span>일자</span>
                <label htmlFor="dateSel" className="sr-only">
                  일자
                </label>
                <select
                  id="dateSel"
                  className="border border-[#cfcfcf] rounded px-1 py-0.5 bg-white"
                  value={dateParam}
                  onChange={(e) => handleDateChange(e.target.value)}
                >
                  <option value="">선택하세요!</option>
                  {availableDates.map((date) => {
                    const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
                    return (
                      <option
                        key={dateStr}
                        value={dateStr}
                        style={getDateOptionStyle(date)}
                      >
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
                  value={timeParam}
                  onChange={(e) => handleTimeChange(e.target.value)}
                >
                  <option value="">{timePlaceholderLabel}</option>
                  {availableTimes.map((t) => (
                    <option key={t} value={t} style={getTimeOptionStyle()}>
                      {formatTime(t)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* 상단 우측 부가 버튼 제거 (예매대기 불필요) */}
          </div>
        </div>
        {/* 본문 880 x 680 (내부 좌우 10 마진 → 880폭) */}
        <div className="w-[880px] h-[610px]">
          <div className="mx-[10px] h-full flex gap-2">
            {/* 좌측: 좌석 영역 660 x 620 */}
            <div
              className="w-[640px] h-[620px] shadow overflow-hidden p-0 bg-transparent"
              style={
                venueKey === "small"
                  ? {
                      backgroundImage:
                        "url(/performance-halls/charlotte-theater-background.jpg)",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center",
                      backgroundSize: "contain",
                    }
                  : undefined
              }
            >
              {venueKey === "small" && (
                <SmallVenue
                  selectedIds={selected.map((s) => s.id)}
                  onToggleSeat={(seat) => {
                    const price =
                      seat.price ?? getPriceByGradeLabel(seat.gradeLabel);
                    setSelected((prev) => {
                      const exists = prev.some((x) => x.id === seat.id);
                      if (exists) return prev.filter((x) => x.id !== seat.id);
                      if (prev.length >= 2) return prev;
                      return [
                        ...prev,
                        {
                          id: seat.id,
                          gradeLabel: seat.gradeLabel,
                          label: seat.label,
                          price,
                        },
                      ];
                    });
                  }}
                />
              )}
              {venueKey === "medium" && (
                <MediumVenue
                  onBackToOverview={mediumVenueRef}
                  selectedIds={selected.map((s) => s.id)}
                  onToggleSeat={(seat) => {
                    const price =
                      seat.price ?? getPriceByGradeLabel(seat.gradeLabel);
                    setSelected((prev) => {
                      const exists = prev.some((x) => x.id === seat.id);
                      if (exists) return prev.filter((x) => x.id !== seat.id);
                      if (prev.length >= 2) return prev;
                      return [
                        ...prev,
                        {
                          id: seat.id,
                          gradeLabel: seat.gradeLabel,
                          label: seat.label,
                          price,
                        },
                      ];
                    });
                  }}
                />
              )}
              {venueKey === "large" && (
                <LargeVenue
                  onBackToOverview={largeVenueRef}
                  selectedIds={selected.map((s) => s.id)}
                  onToggleSeat={(seat) => {
                    const price =
                      seat.price ?? getPriceByGradeLabel(seat.gradeLabel);
                    setSelected((prev) => {
                      const exists = prev.some((x) => x.id === seat.id);
                      if (exists) return prev.filter((x) => x.id !== seat.id);
                      if (prev.length >= 2) return prev;
                      return [
                        ...prev,
                        {
                          id: seat.id,
                          gradeLabel: seat.gradeLabel,
                          label: seat.label,
                          price,
                        },
                      ];
                    });
                  }}
                />
              )}
            </div>

            {/* 우측: 사이드 정보 220 x 620 */}
            <aside className="w-[220px] h-[620px] space-y-3">
              <SeatSidebarBanner
                hallId={hallId}
                venueKey={venueKey}
                mediumVenueRef={mediumVenueRef}
                largeVenueRef={largeVenueRef}
              />

              {/* 좌석등급 / 잔여석: 선택좌석 위로 이동 */}
              <div className="bg-white rounded-md border border-[#e3e3e3] shadow">
                <div className="px-3 py-2 font-semibold">좌석등급 / 가격</div>
                <div className="px-3 pb-3 text-xs">
                  <SeatGrades hallId={hallId} gradeMeta={GRADE_META} />
                </div>
              </div>

              <div className="bg-white rounded-md border border-[#e3e3e3] shadow">
                <div className="px-3 py-1.5 flex items-center justify-between">
                  <div className="font-semibold">선택좌석</div>
                  <div className="text-[#b02a2a] text-xs">
                    총 {selected.length}석 선택되었습니다.
                  </div>
                </div>
                <div className="p-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left font-normal w-24 whitespace-nowrap px-2">
                          좌석등급
                        </th>
                        <th className="text-left font-normal whitespace-nowrap px-2">
                          좌석번호
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
                            <td className="py-1.5 whitespace-nowrap">
                              {s.gradeLabel}
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
                    className="mt-2 w-full py-2.5 rounded font-bold bg-[linear-gradient(to_bottom,#4383fb,#104bb7)] text-white disabled:cursor-not-allowed"
                  >
                    <span className="inline-flex items-center gap-1">
                      좌석선택완료
                      <ArrowForwardIosIcon style={{ fontSize: 14 }} />
                    </span>
                  </button>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <button
                      onClick={goPrev}
                      className="flex-1 text-[12px] border border-[#9b9b9b] rounded px-1 py-2 bg-[linear-gradient(to_bottom,#f7f7f7,#e2e2e2)] hover:bg-[linear-gradient(to_bottom,#ededed,#d9d9d9)] inline-flex items-center justify-center gap-1 text-gray-700"
                    >
                      <ArrowBackIosNewIcon style={{ fontSize: 12 }} />
                      이전단계
                    </button>
                    <button
                      onClick={clearSelection}
                      className="flex-1 text-[12px] border border-[#9b9b9b] rounded px-1 py-2 bg-[linear-gradient(to_bottom,#f7f7f7,#e2e2e2)] hover:bg-[linear-gradient(to_bottom,#ededed,#d9d9d9)] inline-flex items-center justify-center gap-1 text-gray-700"
                    >
                      <RefreshIcon style={{ fontSize: 14 }} />
                      좌석 다시 선택
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </Viewport>
  );
}
