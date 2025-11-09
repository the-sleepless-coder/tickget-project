import type { PropsWithChildren, ReactNode } from "react";
import Viewport from "./Viewport";

type Props = PropsWithChildren<{
  activeStep: 0 | 1 | 2 | 3 | 4;
  right?: ReactNode;
}>;

const STEP_TITLES = [
  "01 관람일/회차선택",
  "02 좌석 선택",
  "03 가격/할인선택",
  "04 배송선택/주문자확인",
  "05 결제하기",
] as const;

export default function BookingLayout({ activeStep, children }: Props) {
  return (
    <Viewport className="flex flex-col">
      {/* 헤더: 가로 전체(880px) 균등 5분할, 파란계열 컬러 */}
      <div className="w-[880px] flex-shrink-0 bg-[linear-gradient(to_bottom,#f7f7f7,#e2e2e2)] border-b border-[#cfcfcf]">
        <div className="grid grid-cols-5 text-[13px]">
          {STEP_TITLES.map((t, i) => {
            const isActive = i === activeStep;
            return (
              <div
                key={t}
                className={
                  "px-4 py-3 border-r border-[#c7c7c7] flex items-center gap-2 justify-center " +
                  (isActive
                    ? "text-white bg-[linear-gradient(to_bottom,#4383fb,#104bb7)]"
                    : "bg-[#e6f2ff] text-[#1e3a8a]")
                }
              >
                <span className="font-extrabold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-semibold">
                  {t.replace(/^[0-9]{2}\s/, "")}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 컨텐츠 영역 */}
      <div className="w-[880px] flex-1">{children}</div>
    </Viewport>
  );
}
