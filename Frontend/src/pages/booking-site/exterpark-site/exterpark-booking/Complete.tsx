import { paths } from "../../../../app/routes/paths";
import { buildMetricsQueryFromStorage } from "../../../../shared/utils/reserveMetrics";

export default function BookingCompletePage() {
  return (
      <div className="max-w-[860px] mx-auto grid grid-cols-[1fr_260px] gap-3 p-3">
        {/* 좌측 본문 카드 */}
        <section className="bg-white shadow rounded-md border border-[#d1d1d1]">
          <div className="h-3 bg-[#9c2b2b] rounded-t-md" />
          <div className="px-4 py-2 border-b">
            <h1 className="text-[15px] font-bold text-gray-900">
              고객님의 결제가 정상적으로 완료되었습니다.
            </h1>
          </div>

          <div className="p-4 grid grid-cols-[120px_1fr] gap-3">
            <div className="w-28 h-40 bg-gray-200 rounded" />
            <div className="text-sm">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#b74756] text-white font-bold text-[13px] rounded-sm shadow">
                <span>예약번호</span>
                <span className="text-white/95">T2833352540(총 1매)</span>
              </div>
              <dl className="mt-3 border rounded">
                <Row label="상품" value="방 이름 입력" />
                <Row label="장소" value="엑스코 서관 1홀" />
                <Row
                  label="일시"
                  value="2025년 12월 20일 (토) 오후 18시00분 1회"
                />
                <Row label="좌석" value="3구역 3열 23" />
              </dl>

              <dl className="mt-4 border rounded">
                <Row label="예매자" value="홍길동" />
                <Row label="예매자 연락처" value="010-1234-5678" />
                <Row label="티켓수령방법" value="배송 (일괄 배송)" />
                <Row label="받으시는 분" value="홍길동 (010-1234-5678)" />
                <Row
                  label="주소"
                  value="(06220) 서울특별시 강남구 테헤란로 212 멀티캠퍼스"
                />
              </dl>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <section className="border rounded">
                  <div className="px-3 py-2 font-semibold border-b bg-[#f4f4f4]">
                    결제정보
                  </div>
                  <dl className="p-3 text-sm">
                    <Row label="총 결제금액" value="148,700원" strong />
                    <Row label="티켓금액" value="143,000원" />
                    <Row label="수수료" value="2,000원" />
                    <Row label="배송료" value="3,700원" />
                  </dl>
                </section>
                <section className="border rounded">
                  <div className="px-3 py-2 font-semibold border-b bg-[#f4f4f4]">
                    결제상세정보
                  </div>
                  <dl className="p-3 text-sm">
                    <Row label="결제방법" value="무통장입금(148,700원)" />
                    <Row
                      label="입금마감시간"
                      value="2025년 10월 16일 오후 23시 59분"
                    />
                    <Row label="입금계좌" value="국민은행 : 65859013681931" />
                    <Row label="예금주" value="(주)놀유서비스" />
                    <Row label="현금영수증" value="신청하기" />
                  </dl>
                </section>
              </div>

              {/* 하단 안내 문구 */}
              <ul className="mt-4 text-[12px] text-gray-500 space-y-1">
                <li>취소기한 : 2025년 12월 19일 (금) 오후 5시 00분</li>
                <li>취소수수료 : 티켓금액의 0~30%</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 우측 사이드바 */}
        <aside className="flex flex-col justify-end">
          <button
            onClick={() => {
              const qs = buildMetricsQueryFromStorage();
              const target = paths.gameResult + qs;
              try {
                if (window.opener && !window.opener.closed) {
                  window.opener.location.href = target;
                  window.close();
                } else {
                  window.location.href = target;
                }
              } catch {
                window.location.href = target;
              }
            }}
            className="w-full py-4 bg-[#c62828] hover:bg-[#b71c1c] text-white rounded-md font-semibold tracking-wide shadow"
          >
            예매내역확인 ▸
          </button>
        </aside>
      </div>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] border-b last:border-b-0">
      <dt className="px-3 py-2 bg-[#fafafa] text-gray-600">{label}</dt>
      <dd
        className={`px-3 py-2 ${strong ? "font-extrabold text-[#b02a2a]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
