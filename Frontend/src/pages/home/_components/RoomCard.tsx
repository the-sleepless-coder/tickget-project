import { Link } from "react-router-dom";
import { paths } from "../../../app/routes/paths";

type RoomCardVariant = "purple" | "blue" | "green" | "orange" | "gray";

interface RoomCardProps {
  title: string;
  imageSrc?: string;
  capacityText?: string;
  tagsText?: string;
  badgeText?: string;
  variant?: RoomCardVariant;
  to?: string;
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
  imageSrc = "/temp-seats.jpg",
  capacityText = "어려움  |  최대 10명  |  봇 3000명",
  tagsText = "돔형 콘서트장  |  커스텀",
  badgeText,
  variant = "purple",
  to = paths.iTicket,
}: RoomCardProps) {
  const gradient = VARIANT_GRADIENT[variant];
  const badgeBg = VARIANT_BADGE_BG[variant];

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
      <div className="relative p-4">
        <img
          src={imageSrc}
          alt="좌석 배치 이미지"
          className="aspect-[4/3] w-full rounded-md object-contain bg-gray-50"
          loading="lazy"
        />
        {/* bottom overlay gradient */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 via-black/30 to-transparent rounded-b-xl" />
        {/* overlay content */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-4 pb-4">
          <div className="text-white">
            <p className="text-[12px] leading-5 opacity-90">{capacityText}</p>
            <p className="text-[12px] leading-5 opacity-90">{tagsText}</p>
          </div>
          {badgeText ? (
            <span
              className="rounded-full px-3 py-1 text-[11px] font-medium text-white shadow-sm"
              style={{ backgroundColor: badgeBg }}
            >
              {badgeText}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
