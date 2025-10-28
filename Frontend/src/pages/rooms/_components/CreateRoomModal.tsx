import { useMemo, useState } from "react";
import { Modal } from "../../../shared/ui/common/Modal";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import RestoreOutlined from "@mui/icons-material/RestoreOutlined";
import InsertPhotoOutlined from "@mui/icons-material/InsertPhotoOutlined";
import dayjs, { Dayjs } from "dayjs";
import InfoOutlined from "@mui/icons-material/InfoOutlined";

export default function CreateRoomModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [startTime, setStartTime] = useState<Dayjs | null>(dayjs());
  const [size, setSize] = useState<"소형" | "중형" | "대형">("소형");
  const [difficulty, setDifficulty] = useState<"쉬움" | "보통" | "어려움">(
    "쉬움"
  );
  const sizeOptions = useMemo(() => ["소형", "중형", "대형"] as const, []);
  const diffOptions = useMemo(() => ["쉬움", "보통", "어려움"] as const, []);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={<TitleWithInfo />}
      headerActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-sm text-gray-400 hover:text-gray-700 inline-flex items-center gap-1"
            title="설정 저장하기"
          >
            <SettingsOutlined fontSize="small" />
            <span className="hidden sm:inline">설정 저장하기</span>
          </button>
          <button
            type="button"
            className="text-sm text-purple-600 hover:text-purple-700 inline-flex items-center gap-1"
            title="설정 불러오기"
          >
            <RestoreOutlined fontSize="small" />
            <span className="hidden sm:inline">설정 불러오기</span>
          </button>
        </div>
      }
      footer={
        <div className="h-full flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-gray-700 hover:bg-gray-100"
          >
            취소하기
          </button>
          <button
            type="button"
            className="px-4 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700"
          >
            방 생성하기
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-[360px_1fr] gap-8">
        <div className="flex flex-col">
          <div className="grid place-items-center border rounded-xl text-gray-600 bg-gray-100 aspect-[1/1]">
            <div className="text-center">
              <div className="mx-auto mb-3 grid h-20 w-20 place-items-center rounded-lg border bg-white text-gray-400">
                <InsertPhotoOutlined sx={{ fontSize: 36 }} />
              </div>
              <div className="text-gray-500">공연장 썸네일</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <span className="rounded-full bg-c-purple-100 text-purple-700 px-3 py-1 text-xs">
              익스터파크
            </span>
            <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 text-xs">
              워터멜론
            </span>
            <span className="rounded-full bg-orange-100 text-orange-700 px-3 py-1 text-xs">
              NO24
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-5">
          <div>
            <label className="sr-only">방 제목</label>
            <input
              type="text"
              placeholder="방 제목을 입력해주세요."
              className="w-full border-b px-2 py-3 text-lg outline-none"
              maxLength={50}
            />
          </div>

          <div className="flex items-center gap-2">
            {sizeOptions.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setSize(label)}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  size === label
                    ? "bg-purple-100 text-purple-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {diffOptions.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setDifficulty(label)}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  difficulty === label
                    ? "bg-purple-100 text-purple-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[1fr_200px] items-center gap-4">
            <select className="border-b px-2 py-3 text-gray-700">
              <option>공연장 선택</option>
            </select>
            <div className="text-right text-gray-400">(50자)</div>
          </div>

          <div className="grid grid-cols-[1fr_120px] items-center gap-4">
            <input className="border-b px-2 py-3" placeholder="봇 인원수" />
            <div className="text-right text-gray-400">/2000 명</div>
          </div>

          <div className="grid grid-cols-[1fr_120px] items-center gap-4">
            <input className="border-b px-2 py-3" placeholder="참여 인원" />
            <div className="text-right text-gray-400">/20 명</div>
          </div>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <TimePicker
              label="시작 시간"
              value={startTime}
              onChange={(v: Dayjs | null) => setStartTime(v)}
              slotProps={{ textField: { fullWidth: true, size: "small" } }}
            />
          </LocalizationProvider>
        </div>
      </div>
    </Modal>
  );
}

function TitleWithInfo() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xl font-bold">방 만들기</span>
      <InfoBubble />
    </div>
  );
}

function InfoBubble() {
  return (
    <div className="relative group">
      <button
        type="button"
        aria-label="방 만들기 도움말"
        className="grid h-6 w-6 place-items-center rounded-full bg-purple-600 text-white shadow-md focus:outline-none"
      >
        <InfoOutlined sx={{ fontSize: 14 }} />
      </button>
      <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-white px-3 py-2 text-[13px] text-gray-900 shadow-[0_6px_16px_rgba(0,0,0,0.12)] border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
        <span>
          <b className="text-purple-600">AI 봇</b>이 경기에 참여해 실제와 같은
          티켓팅을 연습할 수 있습니다.
        </span>
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0 w-0 border-x-8 border-x-transparent border-t-8 border-t-white drop-shadow-sm" />
      </div>
    </div>
  );
}
