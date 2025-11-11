import { Dayjs } from "dayjs";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs from "dayjs";
import { useMemo, useCallback, useEffect } from "react";

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
  // 한국 시간 기준으로 현재 시간을 5분 단위로 반올림하고, +5분부터 1시간까지 설정
  // const { minTime, maxTime } = useMemo(() => {
  //   const now = dayjs(); // 한국 시간 (dayjs는 기본적으로 로컬 시간 사용)
  //   const currentMinute = now.minute();

  //   // 5분 단위로 반올림
  //   const roundedMinute = Math.ceil(currentMinute / 5) * 5;
  //   const roundedTime = now.minute(roundedMinute).second(0).millisecond(0);

  //   // 반올림한 시간 + 5분을 최소 시간으로 설정
  //   const min = roundedTime.add(5, "minute");

  //   // 최소 시간 + 1시간을 최대 시간으로 설정
  //   const max = min.add(1, "hour");

  //   return { minTime: min, maxTime: max };
  // }, []);

  // 현재 시간 기준으로 1분 단위로 설정 가능
  const { minTime, maxTime } = useMemo(() => {
    const now = dayjs(); // 한국 시간 (dayjs는 기본적으로 로컬 시간 사용)

    // 현재 시간 + 1분을 최소 시간으로 설정
    const min = now.add(1, "minute").second(0).millisecond(0);

    // 최소 시간 + 1시간을 최대 시간으로 설정
    const max = min.add(1, "hour");

    return { minTime: min, maxTime: max };
  }, []);

  // 5분 간격이 아닌 시간을 비활성화하는 함수 (주석 처리됨 - 1분 단위로 변경)
  // const shouldDisableTime = (
  //   value: Dayjs,
  //   view: "hours" | "minutes" | "seconds"
  // ) => {
  //   if (view === "minutes") {
  //     const minute = value.minute();
  //     // 5분 간격이 아닌 분은 비활성화
  //     return minute % 5 !== 0;
  //   }
  //   return false;
  // };

  // 모든 분을 활성화하는 함수 (1분 단위 선택을 위해) - timeSteps 사용으로 불필요
  // const shouldDisableTime = (
  //   value: Dayjs,
  //   view: "hours" | "minutes" | "seconds"
  // ) => {
  //   // 모든 시간과 분을 활성화 (비활성화하지 않음)
  //   return false;
  // };

  // 시간 변경 핸들러: 범위를 벗어나면 자동으로 조정
  const handleTimeChange = useCallback(
    (value: Dayjs | null) => {
      if (!value) {
        setStartTime(null);
        return;
      }

      // 최소 시간보다 작으면 최소 시간으로 설정
      if (value.isBefore(minTime)) {
        setStartTime(minTime);
        return;
      }

      // 최대 시간보다 크면 최대 시간으로 설정
      if (value.isAfter(maxTime)) {
        setStartTime(maxTime);
        return;
      }

      // 5분 간격으로 조정
      // const minute = value.minute();
      // const adjustedMinute = Math.round(minute / 5) * 5;
      // const adjustedTime = value
      //   .minute(adjustedMinute)
      //   .second(0)
      //   .millisecond(0);

      // 1분 단위로 설정 (초와 밀리초만 0으로 설정)
      const adjustedTime = value.second(0).millisecond(0);

      setStartTime(adjustedTime);
    },
    [minTime, maxTime, setStartTime]
  );

  // 처음 세팅 시 가능한 첫 번째 시간으로 자동 설정
  useEffect(() => {
    // startTime이 null이거나 범위를 벗어나면 minTime으로 설정
    if (
      !startTime ||
      startTime.isBefore(minTime, "minute") ||
      startTime.isAfter(maxTime, "minute")
    ) {
      setStartTime(minTime);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minTime, maxTime]);
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
                onChange={handleTimeChange}
                minTime={minTime}
                maxTime={maxTime}
                views={["hours", "minutes"]}
                timeSteps={{ hours: 1, minutes: 1 }}
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
                  popper: {
                    placement: "bottom-start",
                    sx: {
                      zIndex: 9999, // 모달보다 높은 z-index 설정
                    },
                    modifiers: [
                      {
                        name: "offset",
                        options: {
                          offset: [0, 8],
                        },
                      },
                    ],
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
