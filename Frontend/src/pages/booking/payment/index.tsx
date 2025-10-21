import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { paths } from "../../../app/routes/paths";
import Viewport from "../_components/Viewport";

export default function PaymentPage() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<string>("card");
  const [, setCardPlan] = useState<string>("");
  const goPrev = () => navigate(paths.booking.orderConfirm);
  const complete = () => navigate(paths.booking.cancelFee);

  const ticketPrice = 143000;
  const fee = 2000;
  const shipping = 3700;
  const total = ticketPrice + fee + shipping;

  return (
    <Viewport>
      {/* 상단 단계 네비게이션 바 (05 활성) */}
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

      <div className="max-w-[860px] mx-auto p-3 grid grid-cols-[260px_1fr_260px] gap-3">
        {/* 좌측: 결제방식 선택 */}
        <section className="bg-white rounded-md shadow border border-[#e3e3e3]">
          <header className="px-3 py-2 font-bold border-b">결제방식선택</header>
          <div className="p-2 text-sm space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pay"
                checked={method === "card"}
                onChange={() => setMethod("card")}
              />
              신용카드
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pay"
                checked={method === "kb"}
                onChange={() => setMethod("kb")}
              />{" "}
              KB Pay
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pay"
                checked={method === "kakao"}
                onChange={() => setMethod("kakao")}
              />
              카카오페이{" "}
              <span className="ml-1 inline-block text-[10px] px-1 py-0.5 rounded bg-[#f87171] text-white">
                EVENT
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pay"
                checked={method === "bank"}
                onChange={() => setMethod("bank")}
              />{" "}
              무통장입금
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pay"
                checked={method === "mobile"}
                onChange={() => setMethod("mobile")}
              />{" "}
              휴대폰결제
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pay"
                checked={method === "payco"}
                onChange={() => setMethod("payco")}
              />{" "}
              PAYCO
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pay"
                checked={method === "voucher"}
                onChange={() => setMethod("voucher")}
              />{" "}
              공연예매권
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pay"
                checked={method === "youth"}
                onChange={() => setMethod("youth")}
              />
              청년문화예술패스 포인트 사용{" "}
              <span className="text-gray-500">(사용가능: 0P)</span>
            </label>
          </div>

          <div className="border-t p-3 text-[12px] text-gray-700 space-y-2 max-h-48 overflow-auto">
            <div className="font-semibold">사용가능한 포인트</div>
            <ul className="space-y-1">
              <li>마이신한포인트 (1점 이상)</li>
              <li>씨티포인트 (1점 이상)</li>
              <li>삼성 보너스 포인트 (1p 이상)</li>
              <li>외환 YES포인트 (5천p 이상)</li>
            </ul>
          </div>
        </section>

        {/* 가운데: 결제수단 입력 - 선택된 방식에 따라 렌더 */}
        <section className="bg-white rounded-md shadow border border-[#e3e3e3]">
          <header className="px-3 py-2 font-bold border-b flex items-center justify-between">
            <span>결제수단입력</span>
            {method === "card" && (
              <button className="text-[12px] border rounded px-2 py-1">
                무이자할부안내
              </button>
            )}
          </header>
          {method === "bank" ? (
            <div className="p-3 text-sm space-y-3">
              <div className="grid grid-cols-[110px_1fr] gap-y-2 items-center">
                <div className="text-gray-700">입금액</div>
                <div className="font-bold">{total.toLocaleString()}원</div>

                <div className="text-gray-700">입금하실은행</div>
                <div>
                  <select className="border rounded px-2 py-1">
                    <option>국민은행</option>
                    <option>신한은행</option>
                    <option>하나은행</option>
                    <option>우리은행</option>
                  </select>
                </div>
              </div>
              <p className="text-[12px] text-[#b02a2a] leading-5">
                은행에 따라 밤 11시 30분 이후에는 온라인 입금이 지연될 수
                있습니다.
                <br />
                선택한 은행의 입금계좌는 예매확인페이지에서 부여받으시게 됩니다.
              </p>
              <div className="grid grid-cols-[110px_1fr] gap-y-2 items-center">
                <div className="text-gray-700">입금마감시간</div>
                <div>2025년 12월 16일 오후 23시 59분</div>
                <div className="text-gray-700">예금주명</div>
                <div>㈜놀유서비스</div>
              </div>

              <div className="mt-2 border-t pt-3">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">현금영수증</div>
                  <label className="ml-2 text-sm flex items-center gap-1">
                    <input type="checkbox" defaultChecked /> 신청
                  </label>
                </div>
                <div className="mt-2 grid grid-cols-[110px_1fr] gap-y-2 items-center">
                  <div className="text-gray-700">발급 용도</div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1">
                      <input type="radio" name="crPurpose" defaultChecked />{" "}
                      개인소득공제
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="radio" name="crPurpose" /> 사업자지출증빙
                    </label>
                  </div>
                  <div className="text-gray-700">발급기준</div>
                  <div>
                    <select className="border rounded px-2 py-1">
                      <option>휴대폰번호</option>
                      <option>현금영수증카드</option>
                    </select>
                  </div>
                  <div className="text-gray-700">휴대폰번호</div>
                  <div className="flex items-center gap-2">
                    <input
                      className="border rounded px-2 py-1 w-20"
                      defaultValue="010"
                    />
                    -
                    <input
                      className="border rounded px-2 py-1 w-24"
                      defaultValue="1234"
                    />
                    -
                    <input
                      className="border rounded px-2 py-1 w-24"
                      defaultValue="5678"
                    />
                  </div>
                </div>
                <label className="mt-2 inline-flex items-center gap-2 text-[12px]">
                  <input type="checkbox" /> 현금영수증 정보 저장
                </label>
              </div>
            </div>
          ) : (
            <div className="p-3 text-sm space-y-3">
              <div className="font-semibold mb-1">신용카드정보</div>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cardplan"
                  defaultChecked
                  onChange={() => setCardPlan("normal")}
                />{" "}
                일반신용카드
                <select className="ml-2 border rounded px-2 py-1 text-sm">
                  <option>카드종류를 선택하세요</option>
                  <option>국민카드</option>
                  <option>신한카드</option>
                  <option>현대카드</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cardplan"
                  onChange={() => setCardPlan("hana")}
                />{" "}
                하나컬처카드{" "}
                <span className="text-[#b02a2a]">(1만원 청구할인)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cardplan"
                  onChange={() => setCardPlan("lotte")}
                />{" "}
                인터파크롯데카드{" "}
                <span className="text-[#b02a2a]">(5% 청구할인)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cardplan"
                  onChange={() => setCardPlan("nol")}
                />{" "}
                NOL 카드 <span className="text-[#b02a2a]">(10% 적립)</span>
              </label>
              <div className="mt-4 h-28 rounded bg-[repeating-linear-gradient(45deg,#d1d5db,0,#d1d5db_8px,#f8fafc_8px,#f8fafc_16px)] flex items-center justify-center text-gray-600">
                배너 영역
              </div>
            </div>
          )}
        </section>

        {/* 우측: My 예매정보 */}
        <aside className="bg-white rounded-md p-3 shadow border border-[#e3e3e3]">
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

          <div className="mt-3 flex gap-2">
            <button
              onClick={goPrev}
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
