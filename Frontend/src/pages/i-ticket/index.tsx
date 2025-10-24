import { useEffect, useState } from "react";
import { paths } from "../../app/routes/paths";
import { Modal } from "../../shared/ui/common/Modal";
import { Button } from "../../shared/ui/base/Button";
import { GuideNotice } from "./components/GuideNotice";

type Price = {
  grade: string;
  price: number;
};

type Performance = {
  id: string;
  title: string;
  category: string;
  posterUrl: string;
  venue: string;
  period: string;
  duration: string;
  age: string;
  prices: Price[];
  openText: string;
  openAt: string;
  remainingTime: string;
};

// Mock 데이터 (추후 API 연동으로 대체)
const performance: Performance = {
  id: "yb-01",
  title: "YB REMASTERED 3.0 : Transcendent - 대구",
  category: "콘서트",
  posterUrl:
    "https://ticketimage.interpark.com/Play/image/large/23/23013233_p.gif",
  venue: "엑스코 서관 1홀",
  period: "2025.12.20",
  duration: "120분",
  age: "만 7세 이상",
  prices: [
    { grade: "전체가격보기", price: 0 },
    { grade: "SR석", price: 143000 },
    { grade: "R석", price: 132000 },
    { grade: "S석", price: 110000 },
  ],
  openText: "티켓오픈",
  openAt: "2025.10.16 15:00",
  remainingTime: "00:01",
};

export default function ITicketPage() {
  const [secondsLeft, setSecondsLeft] = useState<number>(3);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [dontShowToday, setDontShowToday] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<
    "공연정보" | "캐스팅정보" | "판매정보" | "관람후기" | "기대평"
  >("공연정보");

  const openSeatWindow = () => {
    window.open(
      paths.booking.waiting,
      "_blank",
      "width=900,height=682,toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=no"
    );
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  // 예매 안내 모달 최초 진입 노출 + 하루동안 보지 않기 로직
  useEffect(() => {
    const HIDE_KEY = "iTicketGuideHideUntil";
    const hideUntil = localStorage.getItem(HIDE_KEY);
    const now = Date.now();
    if (!hideUntil || now > Number(hideUntil)) {
      setIsGuideOpen(true);
    }
  }, []);

  const handleCloseGuide = () => {
    const HIDE_KEY = "iTicketGuideHideUntil";
    if (dontShowToday) {
      const until = Date.now() + 24 * 60 * 60 * 1000; // 24시간
      localStorage.setItem(HIDE_KEY, String(until));
    }
    setIsGuideOpen(false);
  };

  const formattedTime = `00:0${secondsLeft}`;
  return (
    <div className="min-h-screen">
      <Modal
        open={isGuideOpen}
        onClose={handleCloseGuide}
        title="예매 안내"
        footer={
          <div className="flex items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={dontShowToday}
                onChange={(e) => setDontShowToday(e.target.checked)}
              />
              하루동안 보지 않기
            </label>
            <Button onClick={handleCloseGuide} className="px-4 py-2">
              닫기
            </Button>
          </div>
        }
      >
        <GuideNotice />
      </Modal>

      {/* 상단 콘텐츠 (포스터/정보 + 우측 예매/달력 박스) */}
      <main className="ticket-container">
        {/* 메인 공연 정보 */}
        <section className="concert-details">
          <div className="tags">
            <span className="tag-exclusive">단독판매</span>
            <span className="tag-wait">예매대기</span>
          </div>

          <h1 className="">{performance.title}</h1>
          <p className="category">{performance.category}</p>

          <div className="content-body">
            {/* 포스터 */}
            <div className="poster">
              <img src={performance.posterUrl} alt={performance.title} />
            </div>

            {/* 정보 표 */}
            <div className="info-table">
              <InfoRow label="장소" value={performance.venue} />
              <InfoRow label="공연기간" value={performance.period} />
              <InfoRow label="공연시간" value={performance.duration} />
              <InfoRow label="관람연령" value={performance.age} />

              <div className="info-row price-info">
                <span className="label">가격</span>
                <div className="value">
                  {performance.prices.map((p, idx) => (
                    <p key={idx}>
                      {p.grade}{" "}
                      {p.price === 0 ? (
                        "▶"
                      ) : (
                        <strong>{p.price.toLocaleString()}</strong>
                      )}
                      원
                    </p>
                  ))}
                </div>
              </div>

              <InfoRow label="혜택" value="무이자할부" />
            </div>
          </div>

          {/* 하단: 탭 & 상세 섹션 (좌측 컨텐츠 영역 안으로 이동) */}
          <div className="mt-10">
            {/* 탭 네비게이션 */}
            <div className="border-b">
              {(
                [
                  "공연정보",
                  "캐스팅정보",
                  "판매정보",
                  "관람후기",
                  "기대평",
                ] as const
              ).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-semibold border-b-2 -mb-[2px] ${
                    activeTab === tab
                      ? "border-[#222] text-[#222]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* 탭 콘텐츠 */}
            <div className="py-5">
              {activeTab === "공연정보" && (
                <PerformanceInfo
                  onOpenCastingSchedule={() => setActiveTab("캐스팅정보")}
                />
              )}
              {activeTab === "캐스팅정보" && <CastingInfoTab />}
              {activeTab === "판매정보" && <SalesInfo />}
              {activeTab === "관람후기" && (
                <EmptyPlaceholder text="등록된 관람후기가 없습니다." />
              )}
              {activeTab === "기대평" && (
                <EmptyPlaceholder text="등록된 기대평이 없습니다." />
              )}
            </div>
          </div>
        </section>

        {/* 우측 티켓팅 박스 */}
        <aside className="ticketing-box">
          {secondsLeft > 0 ? (
            <>
              <h2>티켓오픈안내</h2>
              <div className="d-day-info">
                <p className="d-day-label">D-day</p>
                <p className="d-day-datetime">
                  {performance.openText} {performance.openAt}
                </p>
                <p className="d-day-notice">
                  티켓 오픈 시간은 예고없이 변경될 수 있습니다.
                </p>
              </div>
              <button className="countdown-button" disabled>
                남은시간 {formattedTime}
              </button>
              <div className="promo-links">
                <a href="#">NOL 카드 쓸 때마다 10% 적립</a>
                <a href="#">이 공연이 더 궁금하다면</a>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-bold text-gray-800 mb-2">
                  관람일
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center justify-between text-gray-900 font-semibold mb-2">
                    <button
                      className="px-2 py-1 text-gray-500 hover:text-gray-700"
                      aria-label="prev-month"
                    >
                      ‹
                    </button>
                    <div>2025. 12</div>
                    <button
                      className="px-2 py-1 text-gray-500 hover:text-gray-700"
                      aria-label="next-month"
                    >
                      ›
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-2 text-center text-sm text-gray-500 mb-2">
                    <div>일</div>
                    <div>월</div>
                    <div>화</div>
                    <div>수</div>
                    <div>목</div>
                    <div>금</div>
                    <div>토</div>
                  </div>
                  {/* 2025-12 달력 (고정 렌더링) */}
                  <div className="grid grid-cols-7 gap-2 text-center">
                    {/* 1행 */}
                    <div></div>
                    <div>1</div>
                    <div>2</div>
                    <div>3</div>
                    <div>4</div>
                    <div>5</div>
                    <div>6</div>
                    {/* 2행 */}
                    <div>7</div>
                    <div>8</div>
                    <div>9</div>
                    <div>10</div>
                    <div>11</div>
                    <div>12</div>
                    <div>13</div>
                    {/* 3행 */}
                    <div>14</div>
                    <div>15</div>
                    <div>16</div>
                    <div>17</div>
                    <div>18</div>
                    <div>19</div>
                    <div>
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white">
                        20
                      </span>
                    </div>
                    {/* 4행 */}
                    <div>21</div>
                    <div>22</div>
                    <div>23</div>
                    <div>24</div>
                    <div>25</div>
                    <div>26</div>
                    <div>27</div>
                    {/* 5행 */}
                    <div>28</div>
                    <div>29</div>
                    <div>30</div>
                    <div>31</div>
                    <div></div>
                    <div></div>
                    <div></div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-bold text-gray-800 mb-2">회차</div>
                <div className="bg-white border rounded-lg p-3">
                  <button
                    type="button"
                    onClick={openSeatWindow}
                    className="w-full border rounded-md px-3 py-2 text-left flex items-center justify-between hover:bg-gray-50"
                  >
                    <span>1회 18:00</span>
                  </button>
                  <span className="text-xs text-gray-500">
                    SR석 1820 / R석 752 / S석 436
                  </span>
                </div>
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
    </div>
  );
}

function PerformanceInfo({
  onOpenCastingSchedule,
}: {
  onOpenCastingSchedule: () => void;
}) {
  const cast = [
    {
      name: "김호영",
      role: "찰리",
      img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300",
    },
    {
      name: "이재환",
      role: "찰리",
      img: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=300",
    },
    {
      name: "신재범",
      role: "찰리",
      img: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=301",
    },
    {
      name: "강홍석",
      role: "롤라",
      img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300",
    },
    {
      name: "백형훈",
      role: "롤라",
      img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=301",
    },
    {
      name: "서경수",
      role: "롤라",
      img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=302",
    },
    {
      name: "한재아",
      role: "로렌",
      img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=303",
    },
    {
      name: "허윤슬",
      role: "로렌",
      img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=304",
    },
    {
      name: "신승환",
      role: "돈",
      img: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=300",
    },
    {
      name: "심재현",
      role: "돈",
      img: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=301",
    },
    {
      name: "김동현",
      role: "돈",
      img: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=302",
    },
  ];

  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? cast : cast.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* 캐스팅 섹션 */}
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-extrabold text-gray-900">캐스팅</h3>
          <button
            type="button"
            onClick={onOpenCastingSchedule}
            className="px-3 py-1 rounded-lg border text-sm bg-white hover:bg-gray-50"
          >
            캐스팅 일정조회
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-8 place-items-center">
          {visible.map((c) => (
            <div key={c.name} className="text-center">
              <div className="mx-auto w-28 h-28 rounded-full overflow-hidden bg-gray-200 shadow">
                <img
                  src={c.img}
                  alt={c.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="mt-3 text-sm font-extrabold text-gray-900">
                {c.role}
              </div>
              <div className="text-sm text-gray-600">{c.name}</div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full border rounded-xl py-3 font-semibold text-gray-700 bg-white hover:bg-gray-50"
          >
            {expanded ? "닫기 ▴" : "더보기 ▾"}
          </button>
        </div>
      </section>

      {/* 공연시간 정보 */}
      <section>
        <h3 className="text-lg font-bold text-gray-900">공연시간 정보</h3>
        <ul className="mt-3 text-sm text-gray-700 list-disc pl-5 space-y-1">
          <li>
            화, 목, 금 7시 30분 / 수 2시 30분, 7시 30분 / 토, 일, 공휴일 2시,
            7시
          </li>
          <li>월요일 공연 없음</li>
          <li>
            12/7(토) 2시 30분, 12/24(수) 2시 공연은 2시 30분 공연으로 변경
          </li>
          <li>
            공연사 및 제작사의 사정에 의해 일자 및 회차가 변경될 수 있습니다.
          </li>
        </ul>
      </section>

      {/* 공지사항 섹션 */}
      <section>
        <h3 className="text-lg font-bold text-gray-900">공지사항</h3>
        <div className="mt-3 border rounded bg-white p-4">
          <div className="h-40 rounded bg-[repeating-linear-gradient(45deg,#f3f4f6,0,#f3f4f6_12px,#ffffff_12px,#ffffff_24px)] flex items-center justify-center text-gray-500">
            NOTICE 이미지 영역
          </div>
        </div>
      </section>
    </div>
  );
}

function CastingInfoTab() {
  type RoleKey = "찰리" | "롤라" | "로렌" | "돈";
  type ScheduleRow = {
    date: string; // yyyy-mm-dd
    time: string; // HH:mm
    cast: Record<RoleKey, string>;
  };

  const SCHEDULES: ScheduleRow[] = [
    {
      date: "2025-12-17",
      time: "19:30",
      cast: { 찰리: "이재환", 롤라: "서경수", 로렌: "허윤슬", 돈: "김동현" },
    },
    {
      date: "2025-12-18",
      time: "19:30",
      cast: { 찰리: "신재범", 롤라: "백형훈", 로렌: "한재아", 돈: "심재현" },
    },
    {
      date: "2025-12-19",
      time: "19:30",
      cast: { 찰리: "김호영", 롤라: "강홍석", 로렌: "허윤슬", 돈: "신승환" },
    },
    {
      date: "2025-12-20",
      time: "14:00",
      cast: { 찰리: "이재환", 롤라: "백형훈", 로렌: "한재아", 돈: "김동현" },
    },
    {
      date: "2025-12-20",
      time: "19:00",
      cast: { 찰리: "김호영", 롤라: "서경수", 로렌: "한재아", 돈: "김동현" },
    },
  ];

  const actorChips = [
    "김호영",
    "이재환",
    "신재범",
    "강홍석",
    "백형훈",
    "서경수",
    "한재아",
    "허윤슬",
    "허윤슬",
    "신승환",
    "심재현",
    "김동현",
  ];

  const [startDate, setStartDate] = useState<string>("2025-12-17");
  const [endDate, setEndDate] = useState<string>("2025-12-21");
  const [days, setDays] = useState<string[]>([]); // 예: '화요일'
  const [times, setTimes] = useState<string[]>([]);
  const [selectedActors, setSelectedActors] = useState<string[]>([]);

  const dayLabels = [
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
    "일요일",
  ];
  const timeLabels = ["14:00", "14:30", "19:00", "19:30"];

  const toggle = (arr: string[], v: string, setter: (v: string[]) => void) => {
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const formatDateKR = (iso: string) => {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dow = "일월화수목금토"[d.getDay()];
    return `${mm}/${dd}(${dow})`;
  };

  const getDayLabel = (iso: string) => {
    const d = new Date(iso);
    const dow = "일월화수목금토"[d.getDay()];
    return `${dow}요일`;
  };

  const filtered = SCHEDULES.filter((row) => {
    const t = new Date(row.date).getTime();
    const sOk = startDate ? t >= new Date(startDate).getTime() : true;
    const eOk = endDate ? t <= new Date(endDate).getTime() : true;
    if (!(sOk && eOk)) return false;
    if (days.length > 0 && !days.includes(getDayLabel(row.date))) return false;
    if (times.length > 0 && !times.includes(row.time)) return false;
    if (selectedActors.length > 0) {
      const values = Object.values(row.cast);
      if (!values.some((name) => selectedActors.includes(name))) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        공연일 및 선호하는 배우별 캐스팅일정을 조회할 수 있습니다.
        <span className="ml-1 text-gray-400">?</span>
      </p>
      <p className="text-sm text-gray-500">
        캐스팅 일정은 배우 및 제작사의 사정에 따라 사전공지 없이 변경될 수
        있습니다.
      </p>

      {/* 필터 바 */}
      <div className="border rounded bg-white divide-y">
        {/* 기간 */}
        <div className="grid grid-cols-[100px_1fr] items-center px-3 py-3 gap-3">
          <div className="text-sm font-semibold text-gray-800">공연 기간</div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
            <span>~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
            <button className="ml-2 h-8 w-8 rounded border text-gray-600">
              🔍
            </button>
            <button className="h-8 w-8 rounded border text-gray-600">⚙</button>
          </div>
        </div>

        {/* 요일 */}
        <div className="grid grid-cols-[100px_1fr] items-center px-3 py-3 gap-3">
          <div className="text-sm font-semibold text-gray-800">요일</div>
          <div className="flex flex-wrap gap-2">
            {dayLabels.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggle(days, d, setDays)}
                className={`px-3 py-1 rounded-full text-sm border ${
                  days.includes(d)
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* 공연 시간 */}
        <div className="grid grid-cols-[100px_1fr] items-center px-3 py-3 gap-3">
          <div className="text-sm font-semibold text-gray-800">공연 시간</div>
          <div className="flex flex-wrap gap-2">
            {timeLabels.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggle(times, t, setTimes)}
                className={`px-3 py-1 rounded-full text-sm border ${
                  times.includes(t)
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 캐스팅 */}
        <div className="grid grid-cols-[100px_1fr] items-center px-3 py-3 gap-3">
          <div className="text-sm font-semibold text-gray-800">캐스팅</div>
          <div className="flex flex-wrap gap-2">
            {[...new Set(actorChips)].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => toggle(selectedActors, name, setSelectedActors)}
                className={`px-3 py-1 rounded-full text-sm border ${
                  selectedActors.includes(name)
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="border rounded bg-white overflow-hidden">
        <div className="grid grid-cols-[140px_80px_1fr_1fr_1fr_1fr] bg-[#f6f6f6] text-gray-700 font-semibold text-sm">
          <div className="px-3 py-2 border-r">관람일</div>
          <div className="px-3 py-2 border-r">시간</div>
          <div className="px-3 py-2 border-r">찰리</div>
          <div className="px-3 py-2 border-r">롤라</div>
          <div className="px-3 py-2 border-r">로렌</div>
          <div className="px-3 py-2">돈</div>
        </div>
        {filtered.map((row, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[140px_80px_1fr_1fr_1fr_1fr] odd:bg-white even:bg-[#fcfcfc] text-sm"
          >
            <div className="px-3 py-2 border-t border-r text-blue-700 hover:underline cursor-pointer">
              {formatDateKR(row.date)}
            </div>
            <div className="px-3 py-2 border-t border-r">{row.time}</div>
            <div className="px-3 py-2 border-t border-r">
              {row.cast["찰리"]}
            </div>
            <div className="px-3 py-2 border-t border-r">
              {row.cast["롤라"]}
            </div>
            <div className="px-3 py-2 border-t border-r">
              {row.cast["로렌"]}
            </div>
            <div className="px-3 py-2 border-t">{row.cast["돈"]}</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-10 text-center text-sm text-gray-500">
            조건에 맞는 일정이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

function SalesInfo() {
  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900">판매정보</h3>
      <ul className="mt-3 text-sm text-gray-700 list-disc pl-5 space-y-1">
        <li>예매수수료는 예매일 이후 취소 시 환불되지 않습니다.</li>
        <li>할인 쿠폰 사용 예매는 부분취소가 불가할 수 있습니다.</li>
        <li>배송 시작 후 취소 시 배송료 환불 불가.</li>
      </ul>
    </div>
  );
}

function EmptyPlaceholder({ text }: { text: string }) {
  return (
    <div className="py-16 text-center text-gray-500 bg-white border rounded">
      {text}
    </div>
  );
}
