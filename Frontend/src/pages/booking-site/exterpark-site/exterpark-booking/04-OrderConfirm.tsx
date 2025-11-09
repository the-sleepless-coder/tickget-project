import { useNavigate } from "react-router-dom";
import { useState } from "react";
import BookingLayout from "./_components/BookingLayout";
import { paths } from "../../../../app/routes/paths";

export default function OrderConfirmPage() {
  const navigate = useNavigate();
  const goPrev = () => navigate(paths.booking.price);
  const goNext = () => navigate(paths.booking.payment);

  // 예매자 정보 (제어 컴포넌트)
  const [buyerName, setBuyerName] = useState<string>("홍길동");
  const [birthDate, setBirthDate] = useState<string>("19900101");
  const [phoneFirst, setPhoneFirst] = useState<string>("010");
  const [phoneMiddle, setPhoneMiddle] = useState<string>("1234");
  const [phoneLast, setPhoneLast] = useState<string>("5678");
  const [email, setEmail] = useState<string>("ssafy13@gmail.com");

  return (
    <BookingLayout activeStep={3}>
      <div className="p-3 grid grid-cols-[1fr_260px] gap-3">
        {/* 가운데: 예매자 확인 + 배송지 정보 */}
        <section className="bg-white rounded-md shadow border border-[#e3e3e3]">
          <header className="px-3 py-2 font-bold border-b">예매자 확인</header>
          <div className="p-3 text-sm">
            <div className="grid grid-cols-[100px_1fr_1fr_1fr] items-center gap-2">
              <div className="text-gray-600">이름</div>
              <input
                className="border rounded px-2 py-1 col-span-3"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
              />

              <div className="text-gray-600">생년월일</div>
              <input
                className="border rounded px-2 py-1"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
              <div className="text-gray-600">예) 870201 (YYMMDD)</div>
              <div />

              <div className="text-gray-600">연락처</div>
              <div className="grid grid-cols-3 gap-2 col-span-3">
                <input
                  className="border rounded px-2 py-1"
                  value={phoneFirst}
                  onChange={(e) => setPhoneFirst(e.target.value)}
                />
                <input
                  className="border rounded px-2 py-1"
                  value={phoneMiddle}
                  onChange={(e) => setPhoneMiddle(e.target.value)}
                />
                <input
                  className="border rounded px-2 py-1"
                  value={phoneLast}
                  onChange={(e) => setPhoneLast(e.target.value)}
                />
              </div>

              <div className="text-gray-600">이메일</div>
              <input
                className="border rounded px-2 py-1 col-span-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <p className="mt-3 text-[12px] text-[#b02a2a] leading-5">
              생년월일을 정확히 입력해주세요. 가입 시 입력하신 정보와 다를 경우,
              본인확인이 되지 않아 예매가 불가합니다.
              <br />
              SMS 문자와 이메일로 예매 정보를 보내드립니다.
            </p>

            <div className="mt-4 border-t pt-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">배송지정보</h3>
                <button className="text-[12px] text-gray-500">변경 ▾</button>
              </div>
              <div className="mt-2 space-y-1 text-sm">
                <div>홍길동</div>
                <div>06220</div>
                <div>서울특별시 강남구 테헤란로 212 멀티캠퍼스</div>
                <div>010-1234-5678</div>
              </div>
              <div className="mt-3 text-[12px] text-[#b02a2a] leading-5">
                배송 받는 분의 연락처(휴대폰)로 배송정보(등기번호)가 전송되니
                정확한 정보를 입력해 주세요.
                <br />
                티켓은 직접 수령하셔야 합니다.
              </div>
            </div>
          </div>
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
              <dd className="flex-1">143,000원</dd>
            </div>
            <div className="flex py-1 border-b">
              <dt className="w-24 text-gray-500">수수료</dt>
              <dd className="flex-1">2,000원</dd>
            </div>
            <div className="flex py-1 border-b">
              <dt className="w-24 text-gray-500">배송료</dt>
              <dd className="flex-1">3,700원 | 배송</dd>
            </div>
            <div className="flex py-1">
              <dt className="w-24 text-gray-500">총 결제금액</dt>
              <dd className="flex-1 font-extrabold">148,700원</dd>
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
              onClick={goNext}
              className="flex-1 bg-[linear-gradient(to_bottom,#4383fb,#104bb7)] text-white rounded-md py-2 font-semibold"
            >
              다음단계 ▸
            </button>
          </div>
        </aside>
      </div>
    </BookingLayout>
  );
}
