import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { ConcertHallSearch } from "@/features/search/components/ConcertHallSearch";
import type { ConcertHall } from "@/shared/types/search.types";

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
  selectedHall,
  onSelectHall,
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
  botCount: string;
  setBotCount: (v: string) => void;
  onSelectVenue: (v: string) => void;
  isImageUploaded: boolean;
  onCreate: () => void;
  isGenerating?: boolean;
  isVenueSelected: boolean;
  selectedHall: ConcertHall | null;
  onSelectHall: (hall: ConcertHall | null) => void;
  hasGenerated?: boolean;
  onReset?: () => void;
}) {
  // AI 모드: 썸네일 업로드 + 공연장 선택 시 생성 가능
  // 생성 완료 후에는 "생성" 버튼으로 변경 (초기화용)
  const canCreate =
    step2Mode === "ai"
      ? hasGenerated
        ? true // 생성 완료 후에는 항상 활성화 (초기화 버튼)
        : Boolean(isImageUploaded) && Boolean(selectedHall) && !isGenerating
      : Boolean(isVenueSelected) && isImageUploaded && !isGenerating;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep2Mode("preset")}
          className={`px-4 py-2 rounded-full text-sm cursor-pointer ${
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
          className={`px-4 py-2 rounded-full text-sm cursor-pointer ${
            step2Mode === "ai"
              ? "bg-gray-900 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          AI
        </button>
        {step2Mode === "ai" && (
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-1 text-purple-600 font-semibold cursor-pointer"
            >
              <InfoOutlined sx={{ fontSize: 18 }} /> 업로드 가이드
            </button>
            <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 rounded-xl bg-white shadow-[0_6px_16px_rgba(0,0,0,0.12)] border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="p-4">
                <div className="text-[13px] text-gray-900 mb-3 text-center whitespace-nowrap">
                  공연 안내 이미지 중 배치도만 보이도록 업로드해주세요!
                </div>
                <img
                  src="/test.png"
                  alt="업로드 가이드 예시"
                  className="w-full max-w-[400px] rounded-lg"
                />
              </div>
            </div>
          </div>
        )}
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
          <div className="flex items-center gap-3">
            <div className="relative w-full max-w-[400px]">
              <ConcertHallSearch
                onSelect={(hall) => onSelectHall(hall)}
                placeholder="공연장을 검색하세요"
                selectedHall={selectedHall}
              />
            </div>
            <button
              type="button"
              disabled={!canCreate}
              onClick={hasGenerated ? onReset : onCreate}
              className={`px-2 py-2 rounded-md text-sm font-semibold whitespace-nowrap ${
                canCreate
                  ? "bg-purple-600 text-white hover:bg-purple-700 cursor-pointer"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
            >
              {hasGenerated ? "다시 생성" : "생성하기"}
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
                className={`px-4 py-2 rounded-full text-sm transition-colors cursor-pointer ${
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
