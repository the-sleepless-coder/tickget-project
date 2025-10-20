import { useEffect, useState } from "react";
import { paths } from "../../app/routes/paths";
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

// 개별 페이지 전용 CSS가 필요하면 이렇게 import 해야 적용됩니다.
// import "./style.css";

export default function ITicketPage() {
  const [secondsLeft, setSecondsLeft] = useState<number>(3);
  const openSeatWindow = () => {
    const win = window.open(
      paths.booking.waiting,
      "_blank",
      "width=980,height=780"
    );
    if (win) win.opener = null;
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const formattedTime = `00:0${secondsLeft}`;
  return (
    <div className="min-h-screen">
      {/* 상단 헤더 (임시 로고 자리) */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-sm" aria-hidden />
            <span className="font-semibold text-gray-900">I사 Ticket</span>
          </div>
          <nav className="hidden md:flex gap-6 text-sm text-gray-600">
            <a href="#" className="hover:text-blue-600">
              홈
            </a>
            <a href="#" className="hover:text-blue-600">
              티켓
            </a>
            <a href="#" className="hover:text-blue-600">
              투어
            </a>
            <a href="#" className="hover:text-blue-600">
              이벤트
            </a>
          </nav>
        </div>
      </header>

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
