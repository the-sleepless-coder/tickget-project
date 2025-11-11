import type { RefObject } from "react";

type VenueKind = "small" | "medium" | "large";

interface Props {
  hallId: number | null;
  venueKey: VenueKind;
  mediumVenueRef: RefObject<{ backToOverview: () => void } | null>;
  largeVenueRef: RefObject<{ backToOverview: () => void } | null>;
  onBackToOverview?: () => void; // 클릭 실수 처리를 위한 콜백
}

export default function SeatSidebarBanner({
  hallId,
  venueKey,
  mediumVenueRef,
  largeVenueRef,
  onBackToOverview,
}: Props) {
  // hallId === 2 → 현재 스타일 유지
  if (hallId === 2) {
    return (
      <div className="bg-white rounded-md border border-[#e3e3e3] shadow">
        <div className="px-3 py-2 text-sm bg-[linear-gradient(to_right,#104bb7,#4383fb,#4383fb,#4383fb,#104bb7)] text-white font-semibold rounded-t-md">
          원하시는 좌석 위치를 선택해주세요
        </div>
        <div className="h-[1px] bg-[#e5e5e5] opacity-80" />
        <div className="px-3 py-2 h-40 flex items-center justify-center text-center text-sm font-semibold text-gray-400">
          원하는 위치의 <br /> 좌석을 선택해주세요!
        </div>
      </div>
    );
  }

  // hallId !== 2 → 기존 "좌석도 전체보기" + 안내 텍스트
  const handleBack = () => {
    // 좌석도 전체보기 버튼 클릭은 클릭 실수로 처리
    if (onBackToOverview) {
      onBackToOverview();
    }
    if (venueKey === "medium" && mediumVenueRef.current) {
      mediumVenueRef.current.backToOverview();
      return;
    }
    if (venueKey === "large" && largeVenueRef.current) {
      largeVenueRef.current.backToOverview();
    }
  };

  return (
    <div
      className="mt-3 rounded-md overflow-hidden bg-[linear-gradient(to_right,#104bb7,#4383fb,#4383fb,#4383fb,#104bb7)] text-white cursor-pointer hover:opacity-90 transition-opacity"
      onClick={handleBack}
    >
      <div className="px-3 py-2 font-semibold">≪ 좌석도 전체보기</div>
      <div className="h-[1px] bg-white/30 mx-2" />
      <div className="px-3 py-2 text-sm">원하시는 좌석위치를 선택하세요</div>
    </div>
  );
}
