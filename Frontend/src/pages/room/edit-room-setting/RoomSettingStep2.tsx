import SearchIcon from "@mui/icons-material/Search";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import { useEffect, useMemo, useRef, useState } from "react";
import { VENUE_MOCKS } from "./mockVenues";

export default function Step2AdvancedForm({
  step2Mode,
  setStep2Mode,
  size,
  onChangeSize,
  venue,
  diffOptions,
  difficulty,
  setDifficulty,
  botCount,
  setBotCount,
  onSelectVenue,
  isImageUploaded,
  onCreate,
  isGenerating,
  isVenueSelected,
}: {
  step2Mode: "preset" | "ai";
  setStep2Mode: (m: "preset" | "ai") => void;
  size: "소형" | "중형" | "대형";
  onChangeSize: (s: "소형" | "중형" | "대형") => void;
  venue: string;
  diffOptions: readonly ("초보" | "평균" | "뛰어남")[];
  difficulty: "초보" | "평균" | "뛰어남";
  setDifficulty: (d: "초보" | "평균" | "뛰어남") => void;
  botCount: string;
  setBotCount: (v: string) => void;
  onSelectVenue: (v: string) => void;
  isImageUploaded: boolean;
  onCreate: () => void;
  isGenerating?: boolean;
  isVenueSelected: boolean;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [dropdownRect, setDropdownRect] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return VENUE_MOCKS.slice(0, 6);
    return VENUE_MOCKS.filter((n) =>
      n.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 8);
  }, [search]);
  const canCreate =
    Boolean(isVenueSelected) && isImageUploaded && !isGenerating;
  const isSelected = Boolean(venue) && search === venue;

  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDropdownRect({ left: r.left, top: r.bottom + 4, width: r.width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen]);
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
      </div>

      <div className="text-base font-semibold text-gray-900">공연장 이름</div>
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
          <div className="flex items-center gap-3">
            <div ref={anchorRef} className="relative w-full max-w-[360px]">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearch(v);
                  if (venue && v !== venue) onSelectVenue("");
                }}
                onFocus={() => setIsOpen(true)}
                onBlur={() => setTimeout(() => setIsOpen(false), 100)}
                placeholder="공연장 검색"
                className="w-full rounded-full border border-gray-300 px-5 py-2.5 pr-10 text-gray-700 placeholder:text-gray-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                {isSelected ? (
                  <span className="inline-flex items-center gap-1 text-green-600 text-xs font-semibold">
                    <CheckCircleRounded sx={{ fontSize: 16 }} />
                    선택됨
                  </span>
                ) : (
                  <SearchIcon fontSize="small" className="text-gray-500" />
                )}
              </span>
              {isOpen && filtered.length > 0 && dropdownRect && (
                <ul
                  className="fixed z-[1000] max-h-64 overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-white shadow nice-scroll"
                  style={{
                    left: dropdownRect.left,
                    top: dropdownRect.top,
                    width: dropdownRect.width,
                  }}
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                >
                  {filtered.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onSelectVenue(name);
                          setSearch(name);
                          setIsOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              disabled={!canCreate}
              onClick={onCreate}
              className={`ml-auto px-4 py-2 rounded-md text-sm font-semibold whitespace-nowrap ${
                canCreate
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
            >
              생성하기
            </button>
          </div>
          {null}
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
          <div className="flex items-center gap-2">
            <input
              value={botCount}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "");
                if (digits === "") {
                  setBotCount("");
                  return;
                }
                const num = Math.max(0, Math.min(5000, parseInt(digits, 10)));
                setBotCount(String(num));
              }}
              className="w-full text-gray-600 text-lg font-semibold border-b-2 border-gray-300 px-2 py-3 outline-none focus:border-purple-600"
              placeholder="봇 수 입력 (0 ~ 5000)"
              inputMode="numeric"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
