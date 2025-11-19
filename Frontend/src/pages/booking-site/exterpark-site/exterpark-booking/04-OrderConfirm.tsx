import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import BookingLayout from "./_components/BookingLayout";
import { paths } from "../../../../app/routes/paths";
import dayjs from "dayjs";
import { useAuthStore } from "@features/auth/store";
import { useBlockBackButtonDuringGame } from "../../../../shared/hooks/useBlockBackButtonDuringGame";

type SeatData = {
  grade: string;
  count: number;
  price: number;
};

export default function OrderConfirmPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 경기 중 브라우저 뒤로가기 차단
  useBlockBackButtonDuringGame("04-OrderConfirm");

  const goPrev = () => {
    const prevParams = searchParams.toString();
    const target = paths.booking.price + (prevParams ? `?${prevParams}` : "");
    navigate(target);
  };
  const goNext = () => {
    const nextUrl = new URL(window.location.origin + paths.booking.payment);
    // 선택 좌석 정보 전달
    if (selectedSeats.length > 0) {
      nextUrl.searchParams.set("seats", JSON.stringify(selectedSeats));
    }
    // 가격 정보 전달
    nextUrl.searchParams.set("totalPrice", String(totalPrice));
    nextUrl.searchParams.set("fee", String(fee));
    nextUrl.searchParams.set("deliveryFee", String(deliveryFee));
    nextUrl.searchParams.set("total", String(total));
    // 날짜/시간 정보 전달
    if (dateParam) nextUrl.searchParams.set("date", dateParam);
    if (timeParam) nextUrl.searchParams.set("time", timeParam);
    navigate(nextUrl.pathname + nextUrl.search);
  };

  // URL에서 선택 좌석 정보 가져오기
  const seatsParam = searchParams.get("seats");
  const selectedSeats: SeatData[] = useMemo(() => {
    if (!seatsParam) {
      return [{ grade: "SR석", count: 1, price: 143000 }]; // 기본값
    }
    try {
      const parsed = JSON.parse(decodeURIComponent(seatsParam));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return [{ grade: "SR석", count: 1, price: 143000 }]; // 기본값
    } catch (e) {
      console.error("좌석 정보 파싱 실패:", e);
      return [{ grade: "SR석", count: 1, price: 143000 }]; // 기본값
    }
  }, [seatsParam]);

  // 선택 좌석 요약 텍스트
  const selectedSeatsSummary = useMemo(() => {
    return selectedSeats.map((s) => `${s.grade} ${s.count}석`).join(", ");
  }, [selectedSeats]);

  // 가격 정보
  const totalPrice = Number(searchParams.get("totalPrice")) || 143000;
  const fee = Number(searchParams.get("fee")) || 2000;
  const deliveryFee = 3700; // 배송료는 고정값
  // 총 결제금액 = 티켓금액 + 수수료 + 배송료
  const total = totalPrice + fee + deliveryFee;

  // 날짜/시간 정보
  const dateParam = searchParams.get("date");
  const timeParam = searchParams.get("time");
  const formattedDateTime = useMemo(() => {
    if (!dateParam) return "2025.12.20 (토) 18:00"; // 기본값
    const date = dayjs(dateParam);
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.day()];
    const time = timeParam || "18:00";
    return `${date.format("YYYY.MM.DD")} (${weekday}) ${time}`;
  }, [dateParam, timeParam]);

  // authstore에서 사용자 정보 가져오기
  const storeName = useAuthStore((state) => state.name);
  const storeEmail = useAuthStore((state) => state.email);
  const accessToken = useAuthStore((state) => state.accessToken);

  // 예매자 정보 (제어 컴포넌트)
  const [buyerName, setBuyerName] = useState<string>(storeName || "");
  const [birthDate, setBirthDate] = useState<string>("");
  const [phoneFirst, setPhoneFirst] = useState<string>("010");
  const [phoneMiddle, setPhoneMiddle] = useState<string>("");
  const [phoneLast, setPhoneLast] = useState<string>("");
  const [email, setEmail] = useState<string>(storeEmail || "");

  // 배송지 정보
  const [deliveryName, setDeliveryName] = useState<string>(storeName || "");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [deliveryPhone, setDeliveryPhone] = useState<string>("");

  // API에서 생년월일과 연락처 가져오기
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!accessToken) return;

      try {
        const apiUrl = "/api/v1/dev/user/myprofile";
        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();

          // 생년월일 설정 (YYYY-MM-DD -> YYMMDD)
          if (data.birthDate) {
            const dateStr = data.birthDate;
            if (dateStr.includes("-")) {
              const [year, month, day] = dateStr.split("-");
              const shortYear = year.slice(-2);
              setBirthDate(`${shortYear}${month}${day}`);
            } else {
              // 이미 YYMMDD 형식인 경우
              setBirthDate(dateStr);
            }
          }

          // 연락처 설정 (010-1234-5678 -> 010, 1234, 5678)
          if (data.phone) {
            const phoneParts = data.phone.split("-");
            if (phoneParts.length === 3) {
              setPhoneFirst(phoneParts[0]);
              setPhoneMiddle(phoneParts[1]);
              setPhoneLast(phoneParts[2]);
            } else {
              // 하이픈이 없는 경우 (01012345678)
              const phoneStr = data.phone.replace(/-/g, "");
              if (phoneStr.length >= 10) {
                setPhoneFirst(phoneStr.substring(0, 3));
                setPhoneMiddle(phoneStr.substring(3, phoneStr.length - 4));
                setPhoneLast(phoneStr.substring(phoneStr.length - 4));
              }
            }
          }

          // 이름과 이메일도 업데이트 (authstore에 없을 수 있으므로)
          if (data.name && !storeName) {
            setBuyerName(data.name);
            setDeliveryName(data.name);
          }

          if (data.email && !storeEmail) {
            setEmail(data.email);
          }

          // 배송지 정보 업데이트
          if (data.address) {
            setDeliveryAddress(data.address);
          }

          // 배송지 연락처 설정 (예매자 연락처와 동일)
          if (data.phone) {
            setDeliveryPhone(data.phone);
          }
        }
      } catch (error) {
        console.error("프로필 정보 가져오기 실패:", error);
      }
    };

    fetchUserProfile();
  }, [accessToken, storeName, storeEmail]);

  // authstore의 name과 email이 변경되면 업데이트
  useEffect(() => {
    if (storeName) {
      setBuyerName(storeName);
      setDeliveryName(storeName);
    }
  }, [storeName]);

  useEffect(() => {
    if (storeEmail) {
      setEmail(storeEmail);
    }
  }, [storeEmail]);

  return (
    <BookingLayout activeStep={3}>
      <div className="p-3 grid grid-cols-[1fr_260px] gap-3">
        {/* 가운데: 예매자 확인 + 배송지 정보 */}
        <section className="bg-white rounded-md shadow border border-[#e3e3e3]">
          <header className="px-3 py-2 font-bold border-b flex items-center justify-between">
            <span>예매자 확인</span>
            <span className="text-[12px] text-[#b02a2a] font-normal">
              예매자 및 배송지 정보는 마이페이지에서 수정 가능합니다
            </span>
          </header>
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
              <div className="text-gray-600">예) 900101 (YYMMDD)</div>
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
                {/* <button className="text-[12px] text-gray-500">변경 ▾</button> */}
              </div>
              <div className="mt-2 space-y-1 text-sm">
                <div>{deliveryName || "이름 없음"}</div>
                {deliveryAddress ? (
                  <div>{deliveryAddress}</div>
                ) : (
                  <div className="text-gray-400">주소 정보가 없습니다</div>
                )}
                <div>
                  {deliveryPhone ||
                    (phoneFirst && phoneMiddle && phoneLast
                      ? `${phoneFirst}-${phoneMiddle}-${phoneLast}`
                      : "연락처 정보가 없습니다")}
                </div>
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
              <dd className="flex-1">{formattedDateTime}</dd>
            </div>
            <div className="flex py-1 border-b">
              <dt className="w-24 text-gray-500">선택좌석</dt>
              <dd className="flex-1">{selectedSeatsSummary}</dd>
            </div>
            <div className="flex py-1 border-b">
              <dt className="w-24 text-gray-500">티켓금액</dt>
              <dd className="flex-1">{totalPrice.toLocaleString()}원</dd>
            </div>
            <div className="flex py-1 border-b">
              <dt className="w-24 text-gray-500">수수료</dt>
              <dd className="flex-1">{fee.toLocaleString()}원</dd>
            </div>
            <div className="flex py-1 border-b">
              <dt className="w-24 text-gray-500">배송료</dt>
              <dd className="flex-1">
                {deliveryFee.toLocaleString()}원 | 배송
              </dd>
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
