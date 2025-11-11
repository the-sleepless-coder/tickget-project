import InfoOutlined from "@mui/icons-material/InfoOutlined";
// 공연장 검색창 관련 코드는 요구사항에 따라 주석 처리되었습니다.
// import SearchIcon from "@mui/icons-material/Search";
// import { useEffect, useMemo, useRef, useState } from "react";
// import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
// import { VENUE_MOCKS } from "../edit-room-setting/mockVenues";

export default function Step2AdvancedForm({
  step2Mode,
  setStep2Mode,
  size,
  onChangeSize,
  venue,
  diffOptions,
  difficulty,
  setDifficulty,
  botOptions,
  botCount,
  setBotCount,
  onSelectVenue,
  isImageUploaded,
  onCreate,
  isGenerating,
  isVenueSelected,
  capacityOptions,
  capacity,
  setCapacity,
  hasGenerated,
  onReset,
}: {
  step2Mode: "preset" | "ai";
  setStep2Mode: (m: "preset" | "ai") => void;
  size: "소형" | "중형" | "대형";
  onChangeSize: (s: "소형" | "중형" | "대형") => void;
  venue: string;
  diffOptions: readonly ("초보" | "평균" | "뛰어남")[];
  difficulty: "초보" | "평균" | "뛰어남";
  setDifficulty: (d: "초보" | "평균" | "뛰어남") => void;
  botOptions: readonly number[];
  botCount: string;
  setBotCount: (v: string) => void;
  onSelectVenue: (v: string) => void;
  isImageUploaded: boolean;
  onCreate: () => void;
  isGenerating?: boolean;
  isVenueSelected: boolean;
  capacityOptions: readonly number[];
  capacity: string;
  setCapacity: (v: string) => void;
  hasGenerated?: boolean;
  onReset?: () => void;
}) {
  // 검색 UI 주석 처리 기간 동안 사용되지 않는 콜백 참조 유지
  void onSelectVenue;
  // 공연장 검색창 상태/로직 (주석 처리)
  // const [search, setSearch] = useState("");
  // const [isOpen, setIsOpen] = useState(false);
  // const anchorRef = useRef<HTMLDivElement | null>(null);
  // const [dropdownRect, setDropdownRect] = useState<{
  //   left: number;
  //   top: number;
  //   width: number;
  // } | null>(null);
  // const filtered = useMemo(() => {
  //   const q = search.trim();
  //   if (!q) return VENUE_MOCKS.slice(0, 6);
  //   return VENUE_MOCKS.filter((n) =>
  //     n.toLowerCase().includes(q.toLowerCase())
  //   ).slice(0, 8);
  // }, [search]);
  // const isSelected = Boolean(venue) && search === venue;
  // useEffect(() => {
  //   if (!isOpen) return;
  //   const update = () => {
  //     const el = anchorRef.current;
  //     if (!el) return;
  //     const r = el.getBoundingClientRect();
  //     setDropdownRect({ left: r.left, top: r.bottom + 4, width: r.width });
  //   };
  //   update();
  //   window.addEventListener("resize", update);
  //   window.addEventListener("scroll", update, true);
  //   return () => {
  //     window.removeEventListener("resize", update);
  //     window.removeEventListener("scroll", update, true);
  //   };
  // }, [isOpen]);

  // AI 모드: 썸네일 업로드 + 수용 인원 선택 시 생성 가능
  // 생성 완료 후에는 "생성" 버튼으로 변경 (초기화용)
  const canCreate =
    step2Mode === "ai"
      ? hasGenerated
        ? true // 생성 완료 후에는 항상 활성화 (초기화 버튼)
        : Boolean(isImageUploaded) && Boolean(capacity) && !isGenerating
      : Boolean(isVenueSelected) && isImageUploaded && !isGenerating;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep2Mode("preset")}
          className={`px-4 py-2 rounded-full text-sm ${
            step2Mode === "preset"
              ? "bg-gray-900 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          프리셋
        </button>
        <button
          type="button"
          onClick={() => setStep2Mode("ai")}
          className={`px-4 py-2 rounded-full text-sm ${
            step2Mode === "ai"
              ? "bg-gray-900 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          AI
        </button>
        <div className="relative group">
          <button
            type="button"
            className="flex items-center gap-1 text-purple-600 font-semibold"
          >
            <InfoOutlined sx={{ fontSize: 18 }} /> 업로드 가이드
          </button>
          <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/4 whitespace-nowrap rounded-xl bg-white px-3 py-2 text-[13px] text-gray-900 shadow-[0_6px_16px_rgba(0,0,0,0.12)] border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
            공연 안내 이미지 중 배치도만 보이도록 업로드해주세요!
          </div>
        </div>
      </div>

      <div className="text-base font-semibold text-gray-900">공연장 선택</div>
      {step2Mode === "preset" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <select
              value={size}
              onChange={(e) => onChangeSize(e.target.value as typeof size)}
              className="w-full border-b-2 border-gray-300 px-2 py-3 text-gray-700 outline-none focus:border-purple-600 bg-transparent"
            >
              {(["소형", "중형", "대형"] as const).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="border-b-2 border-gray-300 px-2 py-3 text-gray-700">
            {venue}
          </div>
        </div>
      ) : (
        <div className="w-full">
          {/* 공연장 검색창은 요구사항에 따라 주석처리되었습니다.
          <div className="flex items-center gap-3"> ... </div>
          */}
          <div className="flex items-center gap-3">
            <div className="relative w-full max-w-[220px]">
              <select
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full rounded-none border border-gray-300 px-5 py-2.5 pr-10 text-gray-700 placeholder:text-gray-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 bg-white"
              >
                <option value="">최대 수용 인원</option>
                {capacityOptions.map((n) => (
                  <option key={n} value={n}>
                    {n} 명
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!canCreate}
              onClick={hasGenerated ? onReset : onCreate}
              className={`px-2 py-2 rounded-md text-sm font-semibold whitespace-nowrap ${
                canCreate
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
            >
              {hasGenerated ? "생성" : "생성하기"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="text-gray-800 font-semibold">경쟁봇 설정</div>
          <div className="flex items-center gap-2">
            {diffOptions.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setDifficulty(label)}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  difficulty === label
                    ? label === "초보"
                      ? "bg-[#F9FBAD] text-[#8DBA07]"
                      : label === "평균"
                        ? "bg-[#FFEEA2] text-[#FF8800]"
                        : "bg-[#FFDEDE] text-[#FF4040]"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-white font-semibold mb-2">봇 인원수</div>
          <select
            value={botCount}
            onChange={(e) => setBotCount(e.target.value)}
            className="w-full border-b-2 border-gray-300 px-2 py-3 text-gray-600 outline-none focus:border-purple-600"
          >
            <option value="">봇 인원 선택</option>
            {botOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} 명
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
