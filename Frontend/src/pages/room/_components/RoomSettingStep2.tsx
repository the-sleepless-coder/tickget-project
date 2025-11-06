import InfoOutlined from "@mui/icons-material/InfoOutlined";
import SearchIcon from "@mui/icons-material/Search";

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
}) {
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
        <div className="relative w-full">
          <input
            type="text"
            placeholder="공연장 검색"
            className="w-full rounded-full border border-gray-300 px-5 py-3 pr-12 text-gray-700 placeholder:text-gray-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
            <SearchIcon />
          </span>
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
