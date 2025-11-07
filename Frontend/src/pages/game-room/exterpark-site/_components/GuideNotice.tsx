export function GuideNotice() {
  return (
    <div className="space-y-6 text-sm leading-6 text-gray-700">
      <div>
        <p className="font-semibold text-gray-900 mb-2">유의사항</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>본 페이지의 모든 내용을 숙지 및 동의한 것으로 간주됩니다.</li>
          <li>
            예매 티켓 수령/할인/증빙, 관람 연령, 공연 장소·교통·주차, 좌석 관련
            안내 미숙지로 인한 취소·환불·변경은 불가합니다.
          </li>
          <li>
            예매자 본인의 책임 하에 예매가 진행되며, 부정 결제 및 위법 행위는
            취소될 수 있습니다.
          </li>
        </ul>
      </div>
      <div>
        <p className="font-semibold text-gray-900 mb-2">공연 장소 안내</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            본 공연은 샤롯데씨어터(서울 송파구 올림픽로 240)에서 진행됩니다.
          </li>
          <li>
            주변 교통이 혼잡하여 주차 공간이 매우 협소합니다. 대중교통 이용을
            권장드립니다.
          </li>
          <li>
            교통 및 주차로 인한 지연 입장, 예매 취소/환불/변경은 불가합니다.
          </li>
        </ul>
      </div>
      <div>
        <p className="font-semibold text-gray-900 mb-2">입장 연령 안내</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>8세 이상 관람가(미취학아동 입장 불가)</li>
          <li>공연별로 생년 기준이 상이할 수 있으니 상세 안내를 확인하세요.</li>
        </ul>
      </div>
      <div>
        <p className="font-semibold text-gray-900 mb-2">예매/수령/환불</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            할인 적용 시 필요한 증빙(신분증, 카드 등)을 반드시 지참하세요.
          </li>
          <li>
            예매 취소 수수료는 약관 및 마이페이지 예매내역에서 확인 가능합니다.
          </li>
          <li>공연 당일 취소·변경은 불가합니다.</li>
        </ul>
      </div>
    </div>
  );
}
