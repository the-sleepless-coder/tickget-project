import { useEffect } from "react";
import type { PropsWithChildren } from "react";

type Props = PropsWithChildren<{
  className?: string;
  scroll?: boolean;
}>;

export default function Viewport({
  children,
  className = "",
  scroll = false,
}: Props) {
  useEffect(() => {
    // 내부 뷰포트가 900x680이 되도록 창 크기를 보정
    const targetW = 910;
    const targetH = 700;
    const dw = targetW - window.innerWidth;
    const dh = targetH - window.innerHeight;
    if (dw !== 0 || dh !== 0) {
      try {
        window.resizeBy(dw, dh);
      } catch {
        // 일부 브라우저 정책으로 실패할 수 있으므로 무시
      }
    }
  }, []);
  useEffect(() => {
    // booking 전용: 전역 body 스타일을 리셋하여 정확한 900x682 영역 확보
    const bodyStyle = document.body.style;
    const prev = {
      padding: bodyStyle.padding,
      display: bodyStyle.display,
      justifyContent: bodyStyle.justifyContent,
      alignItems: bodyStyle.alignItems,
    } as const;
    bodyStyle.padding = "0";
    bodyStyle.display = "block";
    bodyStyle.justifyContent = "";
    bodyStyle.alignItems = "";
    return () => {
      bodyStyle.padding = prev.padding;
      bodyStyle.display = prev.display;
      bodyStyle.justifyContent = prev.justifyContent;
      bodyStyle.alignItems = prev.alignItems;
    };
  }, []);
  return (
    <div className="w-[880px] h-[680px] bg-[#efefef] mx-auto">
      <div
        className={(scroll ? "h-full overflow-y-auto " : "h-full ") + className}
      >
        {children}
      </div>
    </div>
  );
}
