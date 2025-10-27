import { Link } from "react-router-dom";
import { paths } from "../../../app/routes/paths";

type RoomCardVariant = "purple" | "blue" | "green" | "orange" | "gray";

interface RoomCardProps {
  title: string;
  imageSrc?: string;
  capacityText?: string;
  badgeText?: string;
  variant?: RoomCardVariant;
  to?: string;
}

const VARIANT_GRADIENT: Record<RoomCardVariant, string> = {
  purple: "from-purple-600 to-indigo-600",
  blue: "from-sky-600 to-blue-600",
  green: "from-emerald-600 to-green-600",
  orange: "from-orange-600 to-rose-600",
  gray: "from-slate-600 to-gray-600",
};

export default function RoomCard({
  title,
  imageSrc = "/tickget-logo.svg",
  capacityText = "어려움  |  최대 10명  |  봇 3000명",
  badgeText,
  variant = "purple",
  to = paths.iTicket,
}: RoomCardProps) {
  const gradient = VARIANT_GRADIENT[variant];

  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-xl bg-white shadow-md transition hover:shadow-lg"
      aria-label={`${title} 연습 방 입장`}
    >
      <div
        className={`h-12 w-full bg-gradient-to-r ${gradient} px-4 flex items-center text-white font-semibold text-sm`}
      >
        {title}
      </div>
      <div className="p-4">
        <img
          src={imageSrc}
          alt="좌석 배치 이미지"
          className="aspect-[4/3] w-full rounded-md object-contain bg-gray-50"
          loading="lazy"
        />
      </div>
      <div className="flex items-center justify-between px-4 pb-4">
        <p className="text-xs text-gray-500">{capacityText}</p>
        {badgeText ? (
          <span className="rounded-full bg-gray-900/80 px-2.5 py-1 text-[11px] font-medium text-white">
            {badgeText}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
