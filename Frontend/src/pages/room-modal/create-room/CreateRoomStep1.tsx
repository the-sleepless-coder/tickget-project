import { Dayjs } from "dayjs";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";

export default function Step1BasicForm({
  title,
  setTitle,
  matchType,
  setMatchType,
  participantCount,
  setParticipantCount,
  startTime,
  setStartTime,
  platform,
  setPlatform,
  showErrors = false,
}: {
  title: string;
  setTitle: (v: string) => void;
  matchType: "solo" | "versus";
  setMatchType: (v: "solo" | "versus") => void;
  participantCount: string;
  setParticipantCount: (v: string) => void;
  startTime: Dayjs | null;
  setStartTime: (v: Dayjs | null) => void;
  platform: string;
  setPlatform: (v: string) => void;
  showErrors?: boolean;
}) {
  return (
    <div className="flex-1 space-y-6">
      <div className="relative">
        <label className="sr-only">방 제목</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          type="text"
          placeholder="방 제목을 입력해주세요"
          className={`w-full border-b-2 ${showErrors && title.trim().length === 0 ? "border-red-500" : "border-gray-300"} font-semibold px-2 py-3 text-xl outline-none text-gray-700 focus:border-purple-600`}
          maxLength={50}
        />
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-6 min-h-[56px] whitespace-nowrap">
          <span className="text-gray-700 font-semibold whitespace-nowrap">
            모드
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMatchType("solo")}
              className={`px-5 py-2 rounded-xl text-sm whitespace-nowrap ${
                matchType === "solo"
                  ? "bg-c-blue-100 text-c-blue-300"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              솔로
            </button>
            <button
              type="button"
              onClick={() => setMatchType("versus")}
              className={`px-5 py-2 rounded-xl text-sm whitespace-nowrap ${
                matchType === "versus"
                  ? "bg-c-blue-100 text-c-blue-300"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              대결
            </button>
          </div>

          <div
            className={`relative min-w-[220px] ${
              matchType === "solo" ? "invisible pointer-events-none" : ""
            }`}
          >
            <input
              value={participantCount}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "");
                if (digits === "") return setParticipantCount("");
                const num = Math.max(2, Math.min(10, parseInt(digits, 10)));
                setParticipantCount(String(num));
              }}
              className={`w-full text-gray-600 text-lg font-semibold border-b-2 ${
                showErrors &&
                matchType === "versus" &&
                participantCount.trim().length === 0
                  ? "border-red-500"
                  : "border-gray-300"
              } px-2 py-3 pr-20 outline-none focus:border-purple-600`}
              placeholder="참가 인원"
              inputMode="numeric"
            />
            <div className="pointer-events-none text-lg absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              (2 ~ 10 명)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8 flex-wrap">
          <span className="text-gray-700 font-semibold">경기 시작</span>
          <div className="w-[160px]">
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <TimePicker
                label={undefined}
                ampm={false}
                format="HH:mm"
                value={startTime}
                onChange={(v) => setStartTime(v)}
                slotProps={{
                  textField: {
                    size: "small",
                    fullWidth: true,
                    sx: {
                      "& .MuiInputBase-root": {
                        borderRadius: "8px",
                        backgroundColor: "#f3f4f6",
                      },
                    },
                  },
                }}
              />
            </LocalizationProvider>
          </div>
        </div>

        <div className="flex flex-wrap gap-5 items-center">
          <span className="text-gray-700 font-semibold">연습 예매처</span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPlatform("익스터파크")}
              className={`px-5 py-2 rounded-xl text-sm ${
                platform === "익스터파크"
                  ? "bg-c-blue-100 text-c-blue-300"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              익스터파크
            </button>
            <button
              type="button"
              onClick={() => window.alert("서비스 준비 중입니다")}
              className="px-5 py-2 rounded-xl text-sm border bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              aria-disabled
            >
              수박티켓
            </button>
            <button
              type="button"
              onClick={() => window.alert("서비스 준비 중입니다")}
              className="px-5 py-2 rounded-xl text-sm border bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              aria-disabled
            >
              NO24
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
