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
    // 내부 뷰포트가 900x682가 되도록 창 크기를 보정
    const targetW = 900;
    const targetH = 682;
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
  return (
    <div className="w-[900px] h-[682px] bg-[#efefef] mx-auto">
      <div
        className={(scroll ? "h-full overflow-y-auto " : "h-full ") + className}
      >
        {children}
      </div>
    </div>
  );
}
