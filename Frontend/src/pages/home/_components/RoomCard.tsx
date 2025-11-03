import { Link } from "react-router-dom";
import { paths } from "../../../app/routes/paths";
import { useEffect, useMemo, useState } from "react";

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
    green: "멜론티켓",
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

  // Extract gradient colors from the poster image
  const [posterGradient, setPosterGradient] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function extract() {
      try {
        type VibrantPalette = {
          Vibrant?: { hex: string };
          Muted?: { hex: string };
          LightVibrant?: { hex: string };
        };
        type VibrantNS = {
          from: (src: string) => { getPalette: () => Promise<VibrantPalette> };
        };
        const imported = (await import("node-vibrant")) as unknown;
        const vibrant =
          (imported as { default?: VibrantNS }).default ||
          (imported as VibrantNS);
        const palette = await vibrant.from(resolvedImageSrc).getPalette();
        const c1 = palette.Vibrant?.hex || gradient.from;
        const c2 =
          palette.Muted?.hex || palette.LightVibrant?.hex || gradient.to;
        if (!cancelled) {
          setPosterGradient(`linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`);
        }
      } catch {
        if (!cancelled) setPosterGradient(null);
      }
    }
    extract();
    return () => {
      cancelled = true;
    };
  }, [resolvedImageSrc, gradient.from, gradient.to]);

  // 우측 정보 영역에서 사용할 참가 인원 텍스트
  const participantsText = useMemo(() => {
    if (!participants) return null;
    return `${participants.current} / ${participants.capacity}명`;
  }, [participants]);

  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-xl bg-white shadow-md transition hover:shadow-lg"
      aria-label={`${title} 연습 방 입장`}
    >
      <div className="flex gap-4 p-4">
        {/* Left: Poster with gradient background derived from image */}
        <div
          className="relative w-[120px] sm:w-[140px] md:w-[160px] aspect-[3/4] overflow-hidden rounded-lg shrink-0"
          style={{
            background:
              posterGradient ||
              `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
          }}
        >
          <img
            src={resolvedImageSrc}
            alt="포스터 이미지"
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          {ongoing ? (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-[#4F4F4F]/50 backdrop-blur-[2px]">
              <span className="text-white text-lg font-extrabold">
                경기 진행중
              </span>
            </div>
          ) : null}
        </div>

        {/* Right: Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="text-sm sm:text-base font-semibold text-gray-900 truncate"
              title={title}
            >
              {title}
            </h3>
            {displayedBadge ? (
              <span
                className="rounded-full px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-white shadow-sm shrink-0"
                style={{ backgroundColor: badgeBg }}
              >
                {displayedBadge}
              </span>
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-600">
            {participantsText ? (
              <span className="font-semibold text-gray-900">
                {participantsText}
              </span>
            ) : null}
            <span>{capacityText}</span>
            <span>{resolvedTagsText}</span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            {startTime ? (
              <span
                className="text-base sm:text-lg font-extrabold"
                style={{ color: badgeBg }}
              >
                {startTime} 시작
              </span>
            ) : (
              <span className="text-sm text-gray-500">상시</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
