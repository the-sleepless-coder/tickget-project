import { Link } from "react-router-dom";
import { paths } from "../../../app/routes/paths";

type RoomCardVariant = "purple" | "blue" | "green" | "orange" | "gray";

interface RoomCardProps {
  title: string;
  imageSrc?: string;
  capacityText?: string;
  tagsText?: string;
  badgeText?: string; // kept for backwards-compat (rooms 페이지)
  variant?: RoomCardVariant;
  to?: string;
  // Home 전용 확장 props
  participants?: { current: number; capacity: number };
  startTime?: string; // e.g., "18:10"
  size?: "small" | "medium" | "large"; // 썸네일 선택과 태그 구성에 사용
  venueName?: string; // 공연장 이름
  ongoing?: boolean; // 경기 진행중 여부
}

const VARIANT_GRADIENT: Record<RoomCardVariant, { from: string; to: string }> =
  {
    // Approximate Tailwind colors
    purple: { from: "#a855f7", to: "#6366f1" },
    blue: { from: "#0ea5e9", to: "#2563eb" },
    green: { from: "#10b981", to: "#22c55e" },
    orange: { from: "#f97316", to: "#ef4444" },
    gray: { from: "#64748b", to: "#6b7280" },
  };

const VARIANT_BADGE_BG: Record<RoomCardVariant, string> = {
  purple: "#7c3aed",
  blue: "#3b82f6",
  green: "#10b981",
  orange: "#f97316",
  gray: "#6b7280",
};

export default function RoomCard({
  title,
  imageSrc,
  capacityText = "어려움  |  최대 10명  |  봇 3000명",
  tagsText,
  badgeText,
  variant = "purple",
  to = paths.iTicket,
  participants,
  startTime,
  size,
  venueName,
  ongoing,
}: RoomCardProps) {
  const gradient = VARIANT_GRADIENT[variant];
  const badgeBg = VARIANT_BADGE_BG[variant];
  // Default badge text by variant (blue/orange/green only)
  const DEFAULT_BADGE_BY_VARIANT: Partial<Record<RoomCardVariant, string>> = {
    blue: "익스터파크",
    orange: "NO24",
    green: "워터멜론",
  };
  const displayedBadge = DEFAULT_BADGE_BY_VARIANT[variant] ?? badgeText;

  // 이미지 소스: size가 지정되면 매핑 이미지 사용
  const imageBySize: Record<NonNullable<typeof size>, string> = {
    small: "/performance-halls/charlotte-theater.jpg",
    medium: "/performance-halls/olympic-hall.jpg",
    large: "/performance-halls/olympic-stadium.jpg",
  };
  const resolvedImageSrc =
    imageSrc ?? (size ? imageBySize[size] : "/temp-seats.jpg");

  // 태그 텍스트: size + venueName가 있으면 덮어쓰기
  const sizeToKorean: Record<NonNullable<typeof size>, string> = {
    small: "소형",
    medium: "중형",
    large: "대형",
  };
  const resolvedTagsText =
    tagsText ??
    (size && venueName
      ? `${sizeToKorean[size]}  |  ${venueName}`
      : "돔형 콘서트장  |  커스텀");

  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-xl bg-white shadow-md transition hover:shadow-lg"
      aria-label={`${title} 연습 방 입장`}
    >
      <div
        className="h-12 w-full px-4 flex items-center text-white font-semibold text-sm truncate"
        style={{
          background: `linear-gradient(90deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
        }}
      >
        <span className="truncate" title={title}>
          {title}
        </span>
      </div>
      <div className="relative">
        <div className="relative aspect-[4/3] w-full rounded-b-xl overflow-hidden">
          <img
            src={resolvedImageSrc}
            alt="좌석 배치 이미지"
            className="absolute inset-0 h-full w-full object-contain bg-gray-50"
            loading="lazy"
          />
          {/* 참가 인원 배지 (우상단) */}
          {participants ? (
            <div className="absolute right-3 top-3 z-20 rounded-full bg-white/95 px-3 py-1 text-[12px] font-semibold text-gray-800 shadow">
              {participants.current} / {participants.capacity}명
            </div>
          ) : null}
          {/* bottom overlay gradient */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          {/* overlay content */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-4 pb-4">
            <div className="text-white">
              <p className="text-[12px] leading-5 opacity-90">{capacityText}</p>
              <p className="text-[12px] leading-5 opacity-90">
                {resolvedTagsText}
              </p>
            </div>
            {startTime ? (
              <span
                className="rounded-full px-3 py-1 text-[12px] font-bold text-white shadow-sm"
                style={{ backgroundColor: badgeBg }}
              >
                {startTime}
              </span>
            ) : displayedBadge ? (
              <span
                className="rounded-full px-3 py-1 text-[11px] font-medium text-white shadow-sm"
                style={{ backgroundColor: badgeBg }}
              >
                {displayedBadge}
              </span>
            ) : null}
          </div>
          {ongoing ? (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-[#4F4F4F]/50 backdrop-blur-[2px]">
              <span className="text-white text-2xl font-extrabold">
                경기 진행중
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
