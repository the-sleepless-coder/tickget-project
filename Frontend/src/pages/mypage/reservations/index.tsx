export default function MyPageReservationsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto p-4">
        {/* 상단 배너 (대체) */}
        <div className="h-16 bg-[repeating-linear-gradient(90deg,#e6eef9,0,#e6eef9_12px,#f2f8ff_12px,#f2f8ff_24px)] border rounded flex items-center px-4 text-[#2b5cab] font-semibold">
          toping 할인 및 선오픈 공연 (데모 배너)
        </div>

        <div className="mt-4 grid grid-cols-[260px_1fr] gap-4">
          {/* 좌측 사이드 메뉴 */}
          <aside className="space-y-3">
            <div className="border rounded p-3">
              <div className="text-sm font-bold">마이페이지</div>
              <div className="mt-2 text-[12px] text-gray-600">
                임유나님은 현재 <b>WELCOME</b>회원입니다.
              </div>
              <div className="mt-2 flex gap-2">
                <button className="px-2 py-1 border rounded text-[12px]">
                  등급별혜택
                </button>
                <button className="px-2 py-1 border rounded text-[12px]">
                  회원정보수정
                </button>
              </div>
            </div>

            <MenuGroup
              title="예매/취소내역"
              items={["공연/스포츠/전시/레저", "예매대기 서비스"]}
            />
            <MenuGroup
              title="증빙서류"
              items={["입금증", "현금영수증", "신용카드 매출전표"]}
            />
            <MenuGroup
              title="예매권/쿠폰"
              items={["공연예매권/스포츠예매권", "공연할인쿠폰", "문화예매권"]}
            />
            <MenuGroup
              title="NOL 잴클래스"
              items={[
                "나의 티켓캐스트",
                "나의 toping",
                "나의 후기",
                "참여이벤트",
                "1:1문의내역",
              ]}
            />
          </aside>

          {/* 메인 컨텐츠 */}
          <main>
            <h1 className="sr-only">예매내역 확인·취소</h1>
            <div className="text-[#b02a2a] font-bold">예매내역확인 · 취소</div>

            {/* 검색/필터 영역 */}
            <div className="mt-3 border rounded p-3 bg-[#fafafa]">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-700">조회기간</span>
                <div className="flex gap-1">
                  {["7일", "15일", "1달", "2달", "3달"].map((d, i) => (
                    <button
                      key={d}
                      className={`px-2 py-1 border rounded ${i === 0 ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "bg-white"}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <div className="ml-2 flex items-center gap-1">
                  <input
                    className="border rounded px-2 py-1 w-28"
                    placeholder="2025-10-10"
                  />
                  <span>~</span>
                  <input
                    className="border rounded px-2 py-1 w-28"
                    placeholder="2025-12-20"
                  />
                </div>
                <div className="ml-2 flex items-center gap-2">
                  <select className="border rounded px-2 py-1">
                    <option>예매일</option>
                    <option>이용일</option>
                  </select>
                  <button className="px-3 py-1 bg-[#b02a2a] text-white rounded">
                    검색
                  </button>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-gray-700">예매상태별 조회</span>
                  <label className="flex items-center gap-1 text-gray-700">
                    <input type="radio" name="st" defaultChecked /> 전체
                  </label>
                  <label className="flex items-center gap-1 text-gray-700">
                    <input type="radio" name="st" /> 예매
                  </label>
                  <label className="flex items-center gap-1 text-gray-700">
                    <input type="radio" name="st" /> 취소
                  </label>
                </div>
              </div>
            </div>

            {/* 테이블 헤더 */}
            <div className="mt-4 border-t border-b bg-[#fafafa] grid grid-cols-[140px_160px_1fr_140px_140px_120px] text-sm text-gray-700">
              <div className="px-3 py-2">예매일</div>
              <div className="px-3 py-2">예약번호</div>
              <div className="px-3 py-2">상품명</div>
              <div className="px-3 py-2">이용일/매수</div>
              <div className="px-3 py-2">취소가능일</div>
              <div className="px-3 py-2">현재상태</div>
            </div>

            {/* 단일 행 (데모 데이터) */}
            <div className="grid grid-cols-[140px_160px_1fr_140px_140px_120px] text-sm items-center">
              <div className="px-3 py-3">2025.10.16</div>
              <div className="px-3 py-3 text-blue-700 underline">
                T2833352540
              </div>
              <div className="px-3 py-3">
                YB REMASTERED 3.0 : Transcendent - 대구
              </div>
              <div className="px-3 py-3">
                <div>2025.12.20 18:00</div>
                <div className="text-gray-500">1매</div>
              </div>
              <div className="px-3 py-3">2025.12.19 17:00</div>
              <div className="px-3 py-3 flex items-center gap-2">
                <span className="inline-block bg-[#b02a2a] text-white text-xs px-2 py-1 rounded">
                  예매
                </span>
                <button className="border px-2 py-1 rounded text-[12px]">
                  상세
                </button>
              </div>
            </div>

            {/* 안내 및 버튼 */}
            <div className="mt-3 text-xs text-[#b02a2a] leading-5">
              [ 상세보기 ]에서 예매 상세내역 확인 및 예매 취소를 하실 수
              있습니다.
              <br />
              <span className="text-gray-600">
                택배 배송이용 예매는 인터넷 취소가 안되며, 배송상품의 티켓이
                취소일 이전까지 인터파크 본사에 접수된 이후에 한하여 취소가
                가능합니다.
              </span>
            </div>

            <div className="mt-4">
              <button className="px-4 py-2 bg-[#b02a2a] text-white rounded">
                패키지/시즌권 부분환불 신청
              </button>
            </div>

            {/* 하단 배너 (대체) */}
            <div className="mt-6 h-24 bg-[repeating-linear-gradient(90deg,#e2d4ff,0,#e2d4ff_12px,#f7f2ff_12px,#f7f2ff_24px)] rounded" />
          </main>
        </div>
      </div>
    </div>
  );
}

function MenuGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border rounded">
      <div className="px-3 py-2 bg-[#fafafa] text-sm font-semibold">
        {title}
      </div>
      <ul className="p-2 text-sm text-gray-700">
        {items.map((it) => (
          <li key={it} className="py-1 border-b last:border-b-0">
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
