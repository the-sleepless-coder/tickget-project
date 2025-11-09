import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  readMetricsWithFallback,
  formatSecondsHuman,
} from "../../../../shared/utils/reserveMetrics";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AdsClickIcon from "@mui/icons-material/AdsClick";
import CloseIcon from "@mui/icons-material/Close";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import AlarmIcon from "@mui/icons-material/Alarm";
import { paths } from "../../../../app/routes/paths";

export default function GameResultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showBanner, setShowBanner] = useState(true);

  const {
    rtSec,
    nrClicks,
    captchaSec,
    capToCompleteSec,
    capBackspaces,
    capWrong,
  } = useMemo(() => readMetricsWithFallback(searchParams), [searchParams]);

  const totalSec = useMemo(() => {
    const seatSec = capToCompleteSec ?? 0;
    return rtSec + captchaSec + seatSec;
  }, [rtSec, captchaSec, capToCompleteSec]);

  const fmt = formatSecondsHuman;

  useEffect(() => {
    // 2분 뒤 자동 이동 → rooms
    const id = setTimeout(
      () => {
        navigate(paths.rooms);
      },
      2 * 60 * 1000
    );
    return () => clearTimeout(id);
  }, [navigate]);

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-6">
      {showBanner && <TopBanner onClose={() => setShowBanner(false)} />}

      {/* 타이틀 + 예매확인 버튼 */}
      <div className="mt-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-gray-900">경기 결과</h1>
        <button
          type="button"
          onClick={() => navigate(paths.mypage.reservations)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 text-indigo-700 px-3 py-2 text-sm font-semibold hover:bg-indigo-100"
        >
          <AlarmIcon fontSize="small" />
          예매 확인
        </button>
      </div>

      {/* 성과 요약 */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg bg-[#6e8ee3] text-white text-center py-4 text-3xl font-extrabold">
          4등
        </div>
        <div className="rounded-lg bg-[#6e8ee3] text-white text-center py-4 text-3xl font-extrabold">
          {fmt(totalSec)}
        </div>
      </div>

      {/* 카드 3개 */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <ResultCard
          title="예매 버튼 클릭"
          items={[
            {
              label: "반응 속도",
              value: `${rtSec.toFixed(2)} 초`,
              icon: (
                <AccessTimeIcon fontSize="small" className="text-gray-500" />
              ),
            },
            {
              label: "클릭 실수",
              value: `${nrClicks}회`,
              icon: <AdsClickIcon fontSize="small" className="text-gray-500" />,
            },
          ]}
        />
        <ResultCard
          title="보안 문자"
          items={[
            {
              label: "소요 시간",
              value: `${captchaSec.toFixed(2)} 초`,
              icon: (
                <AccessTimeIcon fontSize="small" className="text-gray-500" />
              ),
            },
            {
              label: "백스페이스",
              value: `${capBackspaces ?? 0}회`,
              icon: <CloseIcon fontSize="small" className="text-gray-500" />,
            },
            {
              label: "틀린 횟수",
              value: `${capWrong ?? 0}회`,
              icon: <CloseIcon fontSize="small" className="text-gray-500" />,
            },
          ]}
        />
        <ResultCard
          title="좌석 선정"
          items={[
            {
              label: "소요 시간",
              value: `${(capToCompleteSec ?? 0).toFixed(2)} 초`,
              icon: (
                <AccessTimeIcon fontSize="small" className="text-gray-500" />
              ),
            },
            {
              label: "클릭 실수",
              value: "3회",
              icon: <AdsClickIcon fontSize="small" className="text-gray-500" />,
            },
            {
              label: "이선좌",
              value: "2회",
              icon: (
                <EventSeatIcon fontSize="small" className="text-gray-500" />
              ),
            },
          ]}
        />
      </div>

      {/* 하단 버튼 */}
      <div className="mt-8 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => navigate(paths.iTicket)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#e9efff] text-[#143eab] px-6 py-4 text-lg font-extrabold hover:bg-[#dbe6ff]"
        >
          <RestartAltIcon /> 다시하기
        </button>
        <button
          type="button"
          onClick={() => navigate(paths.rooms)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#5b7ae7] text-white px-8 py-4 text-lg font-extrabold hover:bg-[#4d6ad6]"
        >
          <MeetingRoomOutlinedIcon />방 나가기
        </button>
      </div>
    </div>
  );
}

function TopBanner({ onClose }: { onClose: () => void }) {
  return (
    <div className="bg-gradient-to-r from-[#104BB7] to-[#072151] text-white rounded-md">
      <div className="relative px-4 md:px-6 py-2 text-sm">
        <p className="text-center font-semibold">2분 뒤 방으로 돌아갑니다.</p>
        <button
          aria-label="close-banner"
          onClick={onClose}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/90 hover:text-white"
          type="button"
        >
          <CloseIcon fontSize="small" />
        </button>
      </div>
    </div>
  );
}

function ResultCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string; icon?: React.ReactNode }[];
}) {
  return (
    <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="bg-[#eef2ff] px-4 py-3 font-semibold text-[#2f56a5]">
        {title}
      </div>
      <div className="p-5 space-y-3 text-gray-800">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              {it.icon}
              <span>{it.label} :</span>
            </span>
            <span className="font-extrabold">{it.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
