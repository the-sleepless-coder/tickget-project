import { useNavigate } from "react-router-dom";
import { paths } from "../../../../app/routes/paths";
import Viewport from "./_components/Viewport";

export default function CancelFeePage() {
  const navigate = useNavigate();
  const goBack = () => navigate(paths.booking.payment);
  const complete = () => navigate(paths.booking.complete);
  const ticketPrice = 143000;
  const fee = 2000;
  const shipping = 3700;
  const total = ticketPrice + fee + shipping;

  return (
    <Viewport>
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
                (i === 4
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

      <div className="max-w-[860px] mx-auto p-3 grid grid-cols-[1fr_260px] gap-3">
        <section className="bg-white rounded-md shadow border border-[#e3e3e3]">
          <div className="px-3 py-2 font-bold border-b">취소 수수료</div>
          <div className="p-4 text-sm">
            <div className="border rounded overflow-hidden">
              <div className="grid grid-cols-[1fr_160px_160px] bg-[#f6f6f6] text-gray-700 font-semibold">
                <div className="px-3 py-2 border-r">내용</div>
                <div className="px-3 py-2 border-r">취소일</div>
                <div className="px-3 py-2">취소수수료</div>
              </div>
              {[
                { n: "미부과기간", d: "2025.10.16 ~ 2025.10.23", f: "없음" },
                {
                  n: "예매후 8일~관람일 10일전까지",
                  d: "2025.10.24 ~ 2025.12.10",
                  f: "장당 4000원(티켓금액의 10%한도)",
                },
                {
                  n: "관람일 9일전~7일전까지",
                  d: "2025.12.11 ~ 2025.12.13",
                  f: "티켓금액의 10%",
                },
                {
                  n: "관람일 6일전~3일전까지",
                  d: "2025.12.14 ~ 2025.12.17",
                  f: "티켓금액의 20%",
                },
                {
                  n: "관람일 2일전~1일전까지",
                  d: "2025.12.18 ~ 2025.12.19",
                  f: "티켓금액의 30%",
                },
              ].map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_160px_160px] odd:bg-white even:bg-[#fcfcfc]"
                >
                  <div className="px-3 py-2 border-t border-r">{row.n}</div>
                  <div className="px-3 py-2 border-t border-r">{row.d}</div>
                  <div className="px-3 py-2 border-t">{row.f}</div>
                </div>
              ))}
            </div>

            <ul className="mt-3 text-[12px] text-[#b02a2a] space-y-1">
              <li>취소기한 : 2025년 12월 19일(금) 17:00</li>
              <li>예매수수료는 예매일 이후 취소시에는 환불되지 않습니다.</li>
              <li>
                단, 예매 당일 밤 12시 이전 취소시는 취소수수료 없음(취소기한
                내에 한함)
              </li>
              <li>
                배송 시작 후 취소 시에는 배송비가 환불되지 않으며, 취소수수료는
                반송된 티켓의 입찰을 기준으로 부과됩니다.
              </li>
            </ul>
          </div>
        </section>

        <aside className="bg-white rounded-md p-3 shadow border border-[#e3e3e3] h-fit">
          <div className="text-sm font-semibold mb-2">My예매정보</div>
          <dl className="text-sm text-gray-700">
            <div className="flex py-1 border-b">
              <dt className="w-24 text-gray-500">일시</dt>
              <dd className="flex-1">2025.12.20 (토) 18:00</dd>
            </div>
            <div className="flex py-1 border-b">
              <dt className="w-24 text-gray-500">선택좌석</dt>
              <dd className="flex-1">SR석 1석</dd>
            </div>
            <div className="flex py-1 border-b">
              <dt className="w-24 text-gray-500">티켓금액</dt>
              <dd className="flex-1">{ticketPrice.toLocaleString()}원</dd>
            </div>
            <div className="flex py-1 border-b">
              <dt className="w-24 text-gray-500">수수료</dt>
              <dd className="flex-1">{fee.toLocaleString()}원</dd>
            </div>
            <div className="flex py-1 border-b">
              <dt className="w-24 text-gray-500">배송료</dt>
              <dd className="flex-1">{shipping.toLocaleString()}원 | 배송</dd>
            </div>
            <div className="flex py-1">
              <dt className="w-24 text-gray-500">총 결제금액</dt>
              <dd className="flex-1 font-extrabold">
                {total.toLocaleString()}원
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex gap-2">
            <button
              onClick={goBack}
              className="flex-1 bg-[#5a5a5a] hover:bg-[#4a4a4a] text-white rounded-md py-2 font-semibold"
            >
              이전단계
            </button>
            <button
              onClick={complete}
              className="flex-1 bg-[#c62828] hover:bg-[#b71c1c] text-white rounded-md py-2 font-semibold"
            >
              결제하기
            </button>
          </div>
        </aside>
      </div>
    </Viewport>
  );
}
