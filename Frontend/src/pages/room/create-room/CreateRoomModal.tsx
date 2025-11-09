import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";

// moved usages into child components
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/ko";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import Thumbnail01 from "../../../shared/images/thumbnail/Thumbnail01.webp";
import Thumbnail02 from "../../../shared/images/thumbnail/Thumbnail02.webp";
import Thumbnail03 from "../../../shared/images/thumbnail/Thumbnail03.webp";
import Thumbnail04 from "../../../shared/images/thumbnail/Thumbnail04.webp";
import Thumbnail05 from "../../../shared/images/thumbnail/Thumbnail05.webp";
import Thumbnail06 from "../../../shared/images/thumbnail/Thumbnail06.webp";
import { paths } from "../../../app/routes/paths";
import LeftPane from "./CreateRoomLeftPane";
import CreateRoomStep1 from "./CreateRoomStep1";
import CreateRoomStep2 from "./CreateRoomStep2";
import ThumbnailSelectModal from "./CreateRoomThumbnailSelect";
import { Snackbar, Alert } from "@mui/material";
import { useAuthStore } from "@features/auth/store";
import { createRoom } from "@features/room/api";
import type { CreateRoomRequest } from "@features/room/types";

export default function CreateRoomModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  dayjs.locale("ko");
  const userId = useAuthStore((state) => state.userId);
  const username = useAuthStore((state) => state.nickname);
  const [step, setStep] = useState<1 | 2>(1);
  const [startTime, setStartTime] = useState<Dayjs | null>(dayjs());
  const [title, setTitle] = useState("");
  const [matchType, setMatchType] = useState<"solo" | "versus">("solo");
  const [size, setSize] = useState<"소형" | "중형" | "대형">("소형");
  const [difficulty, setDifficulty] = useState<"초보" | "평균" | "뛰어남">(
    "초보"
  );
  const [step2Mode, setStep2Mode] = useState<"preset" | "ai">("preset");
  const [venue, setVenue] = useState("");
  const [venueSelected, setVenueSelected] = useState(false);
  const [platform, setPlatform] = useState<string>("익스터파크");
  const [botCount, setBotCount] = useState<string>("");
  const [participantCount, setParticipantCount] = useState<string>("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [layoutUrl, setLayoutUrl] = useState<string | null>(null);
  const [thumbPickerOpen, setThumbPickerOpen] = useState(false);
  const [showStep1Errors, setShowStep1Errors] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [canFinalize, setCanFinalize] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  type SizeOption = "소형" | "중형" | "대형";
  const diffOptions = useMemo(() => ["초보", "평균", "뛰어남"] as const, []);
  const botOptions = useMemo(() => [100, 500, 1000, 2000, 5000] as const, []);
  const sizeToVenues: Record<SizeOption, string[]> = useMemo(
    () => ({
      소형: ["샤롯데씨어터"],
      중형: ["올림픽공원 올림픽홀"],
      대형: ["인스파이어 아레나"],
    }),
    []
  );
  const handleSelectSize = (label: SizeOption) => {
    setSize(label);
    const [first] = sizeToVenues[label];
    setVenue(first);
    setVenueSelected(false);
  };
  const thumbnails = useMemo(
    () => [
      Thumbnail01,
      Thumbnail02,
      Thumbnail03,
      Thumbnail04,
      Thumbnail05,
      Thumbnail06,
    ],
    []
  );
  const setRandomThumbnail = useCallback(() => {
    const idx = Math.floor(Math.random() * thumbnails.length);
    setThumbnailUrl(thumbnails[idx]);
  }, [thumbnails]);
  const onThumbnailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) return;

    const isValidMime = file.type === "image/jpeg" || file.type === "image/png";
    const isValidExt = /\.(jpe?g|png)$/i.test(file.name);
    const isValid = isValidMime || isValidExt;

    if (!isValid) {
      setToastOpen(true);
      inputEl.value = "";
      // If a previous blob preview (e.g., GIF) exists, revoke and clear it
      if (thumbnailUrl && thumbnailUrl.startsWith("blob:")) {
        URL.revokeObjectURL(thumbnailUrl);
        setThumbnailUrl(null);
      }
      setThumbnailFile(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    if (thumbnailUrl && thumbnailUrl.startsWith("blob:"))
      URL.revokeObjectURL(thumbnailUrl);
    setThumbnailUrl(nextUrl);
    setThumbnailFile(file);
  };
  const triggerUpload = () => {
    const el = document.getElementById(
      "room-thumbnail"
    ) as HTMLInputElement | null;
    el?.click();
  };
  const onLayoutChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) return;

    const isValidMime = file.type === "image/jpeg" || file.type === "image/png";
    const isValidExt = /\.(jpe?g|png)$/i.test(file.name);
    const isValid = isValidMime || isValidExt;

    if (!isValid) {
      setToastOpen(true);
      inputEl.value = "";
      if (layoutUrl && layoutUrl.startsWith("blob:")) {
        URL.revokeObjectURL(layoutUrl);
        setLayoutUrl(null);
      }
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    if (layoutUrl && layoutUrl.startsWith("blob:"))
      URL.revokeObjectURL(layoutUrl);
    setLayoutUrl(nextUrl);
  };

  // 로컬 스토리지에 설정 저장
  const handleSaveSettings = () => {
    const settings = {
      title,
      participantCount,
      startTime: startTime?.toISOString() || null,
      platform,
      matchType,
      size,
      venue,
      difficulty,
      botCount,
    };
    localStorage.setItem("roomSettings", JSON.stringify(settings));
    alert("설정이 저장되었습니다.");
  };

  // 로컬 스토리지에서 설정 불러오기
  const handleLoadSettings = () => {
    const saved = localStorage.getItem("roomSettings");
    if (!saved) {
      alert("저장된 설정이 없습니다.");
      return;
    }
    try {
      const settings = JSON.parse(saved);
      setTitle(settings.title || "");
      setParticipantCount(settings.participantCount || "");
      setStartTime(settings.startTime ? dayjs(settings.startTime) : dayjs());
      setPlatform(settings.platform || "익스터파크");
      setMatchType(settings.matchType === "versus" ? "versus" : "solo");
      setSize(settings.size || "소형");
      setVenue(settings.venue || "샤롯데씨어터");
      setDifficulty(settings.difficulty || "초보");
      setBotCount(settings.botCount || "");
      alert("설정을 불러왔습니다.");
    } catch (error) {
      alert("설정을 불러오는데 실패했습니다.");
      console.error(error);
    }
  };
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    // reset all fields back to defaults when opening
    setStep(1);
    setTitle("");
    setParticipantCount("");
    setStartTime(dayjs());
    setPlatform("익스터파크");
    setMatchType("solo");
    setSize("소형");
    setVenue("");
    setDifficulty("초보");
    setBotCount("");
    setStep2Mode("preset");
    setShowStep1Errors(false);
    setThumbPickerOpen(false);
    setToastOpen(false);
    setIsGenerating(false);
    setCanFinalize(false);
    setVenueSelected(false);
    // clear previous uploads when reopening
    if (thumbnailUrl && thumbnailUrl.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailUrl);
    }
    setThumbnailUrl(null);
    setThumbnailFile(null);
    if (layoutUrl && layoutUrl.startsWith("blob:")) {
      URL.revokeObjectURL(layoutUrl);
    }
    setLayoutUrl(null);
    setIsCreating(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!thumbnailUrl) setRandomThumbnail();
  }, [open, thumbnailUrl, setRandomThumbnail]);

  // Step2: 모드별 '방만들기' 버튼 활성화 조건
  useEffect(() => {
    if (step !== 2) return;
    if (step2Mode === "preset") {
      const okPreset =
        Boolean(venue && venue.trim().length > 0) &&
        Boolean(botCount && botCount.trim().length > 0);
      setCanFinalize(okPreset);
      return;
    }
    if (step2Mode === "ai") {
      const hasImage = Boolean(layoutUrl);
      const okAi =
        hasImage &&
        Boolean(venueSelected) &&
        Boolean(difficulty) &&
        Boolean(botCount && botCount.trim().length > 0);
      setCanFinalize(okAi);
      return;
    }
  }, [step, step2Mode, venue, venueSelected, difficulty, botCount, layoutUrl]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative bg-white rounded-xl shadow-lg w-full max-w-[105vh] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="mt-4 px-8 bg-white rounded-t-xl flex-shrink-0">
          <div className="flex items-center justify-between h-[50px]">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold">
                <TitleWithInfo />
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSettings}
                  className="text-sm text-purple-300 inline-flex items-center gap-1 cursor-pointer"
                  title="설정 불러오기"
                >
                  <span className="hidden sm:inline">설정 불러오기</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="text-sm text-purple-600 inline-flex items-center gap-1 cursor-pointer"
                  title="현재 설정 저장"
                >
                  <span className="hidden sm:inline">현재 설정 저장</span>
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="모달 닫기"
                className="text-2xl leading-none text-gray-400 cursor-pointer"
              >
                ×
              </button>
            </div>
          </div>
          {/* small screens: actions in separate row, right-aligned */}
          <div className="mt-2 flex justify-end gap-2 md:hidden">
            <button
              type="button"
              onClick={handleSaveSettings}
              className="text-sm text-gray-600 hover:text-gray-500 inline-flex items-center gap-1 cursor-pointer"
              title="현재 설정 저장"
            >
              <span className="inline">현재 설정 저장</span>
            </button>
            <button
              type="button"
              onClick={handleLoadSettings}
              className="text-sm text-c-purple-200 inline-flex items-center gap-1 cursor-pointer"
              title="설정 불러오기"
            >
              <span className="inline">설정 불러오기</span>
            </button>
          </div>
        </div>
        <div className="px-8 py-2 flex-1 overflow-y-auto">
          <div
            className={`grid grid-cols-1 ${step === 1 ? "md:grid-cols-[230px_1fr]" : "md:grid-cols-[230px_420px]"} gap-6`}
          >
            <LeftPane
              step={step}
              thumbnailUrl={thumbnailUrl}
              onThumbnailChange={onThumbnailChange}
              onPresetClick={() => setThumbPickerOpen(true)}
              onUploadClick={triggerUpload}
              layoutUrl={layoutUrl}
              onLayoutChange={onLayoutChange}
              size={size}
              venue={venue}
              isAIMode={step === 2 && step2Mode === "ai"}
              isPresetMode={step === 2 && step2Mode === "preset"}
              showLoader={isGenerating}
            />

            {step === 1 ? (
              <CreateRoomStep1
                title={title}
                setTitle={setTitle}
                matchType={matchType}
                setMatchType={setMatchType}
                participantCount={participantCount}
                setParticipantCount={setParticipantCount}
                startTime={startTime}
                setStartTime={setStartTime}
                platform={platform}
                setPlatform={setPlatform}
                showErrors={showStep1Errors}
              />
            ) : (
              <CreateRoomStep2
                step2Mode={step2Mode}
                setStep2Mode={setStep2Mode}
                size={size}
                onChangeSize={(s) => handleSelectSize(s)}
                venue={venue}
                diffOptions={diffOptions}
                difficulty={difficulty}
                setDifficulty={setDifficulty}
                botOptions={botOptions}
                botCount={botCount}
                setBotCount={setBotCount}
                onSelectVenue={(v) => {
                  setVenue(v);
                  setVenueSelected(Boolean(v));
                }}
                isImageUploaded={Boolean(layoutUrl)}
                onCreate={() => {
                  setIsGenerating(true);
                  setCanFinalize(false);
                  setTimeout(() => {
                    setIsGenerating(false);
                    setCanFinalize(true);
                  }, 5000);
                }}
                isGenerating={isGenerating}
                isVenueSelected={venueSelected}
              />
            )}
          </div>
        </div>
        {/* Footer */}
        <div className="mb-4 h-[50px] px-8 rounded-b-xl flex-shrink-0 flex items-center justify-end gap-3">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer"
              >
                취소하기
              </button>
              <button
                type="button"
                onClick={() => {
                  const isTitleValid = title.trim().length > 0;
                  const isParticipantValid =
                    matchType === "solo" || participantCount.trim().length > 0;
                  if (isTitleValid && isParticipantValid) {
                    setShowStep1Errors(false);
                    setStep(2);
                  } else {
                    setShowStep1Errors(true);
                  }
                }}
                className="px-4 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 font-semibold cursor-pointer"
              >
                다음으로
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setShowStep1Errors(false);
                }}
                className="px-4 py-1.5 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer"
              >
                이전으로
              </button>
              <button
                type="button"
                disabled={!canFinalize || isCreating}
                onClick={async () => {
                  if (!canFinalize || isCreating) return;
                  
                  // 필수 값 검증
                  if (!userId || !username) {
                    alert("로그인이 필요합니다.");
                    return;
                  }
                  if (!title.trim()) {
                    setShowStep1Errors(true);
                    return;
                  }
                  if (!startTime) {
                    alert("시작 시간을 선택해주세요.");
                    return;
                  }
                  if (!venue) {
                    alert("공연장을 선택해주세요.");
                    return;
                  }
                  if (!botCount) {
                    alert("봇 인원수를 선택해주세요.");
                    return;
                  }
                  if (matchType === "versus" && !participantCount) {
                    setShowStep1Errors(true);
                    return;
                  }

                  setIsCreating(true);

                  try {
                    // hallId 매핑
                    const hallIdMap: Record<string, number> = {
                      "샤롯데씨어터": 2,
                      "올림픽공원 올림픽홀": 3,
                      "인스파이어 아레나": 4,
                    };
                    const hallId = hallIdMap[venue];
                    if (!hallId) {
                      throw new Error("알 수 없는 공연장입니다.");
                    }

                    // totalSeat 매핑
                    const totalSeatMap: Record<string, number> = {
                      "샤롯데씨어터": 1236,
                      "올림픽공원 올림픽홀": 4256,
                      "인스파이어 아레나": 16424,
                    };
                    const totalSeat = totalSeatMap[venue];
                    if (!totalSeat) {
                      throw new Error("알 수 없는 공연장입니다.");
                    }

                    // difficulty 매핑
                    const difficultyMap: Record<string, "EASY" | "MEDIUM" | "HARD"> = {
                      "초보": "EASY",
                      "평균": "MEDIUM",
                      "뛰어남": "HARD",
                    };
                    const difficultyValue = difficultyMap[difficulty];

                    // roomType 매핑
                    const roomType = matchType === "solo" ? "SOLO" : "MULTI";

                    // maxUserCount
                    const maxUserCount = matchType === "solo" ? 1 : parseInt(participantCount, 10);

                    // reservationDay (yyyy-MM-dd)
                    const reservationDay = startTime.format("YYYY-MM-DD");

                    // gameStartTime (ISO string)
                    const gameStartTime = startTime.toISOString();

                    // thumbnailType 및 thumbnailValue
                    const isUploaded = thumbnailUrl?.startsWith("blob:") && thumbnailFile !== null;
                    const thumbnailType = isUploaded ? "UPLOADED" : "PRESET";
                    
                    let thumbnailValue: string | null = null;
                    if (thumbnailType === "PRESET") {
                      // 썸네일 번호 추출: thumbnails 배열에서 인덱스 찾기
                      const thumbnailIndex = thumbnails.findIndex((thumb) => thumb === thumbnailUrl);
                      if (thumbnailIndex >= 0) {
                        thumbnailValue = String(thumbnailIndex + 1); // 1-based index
                      } else {
                        // URL에서 직접 추출 시도 (Thumbnail01 -> "1")
                        const thumbnailMatch = thumbnailUrl?.match(/Thumbnail(\d+)/);
                        if (thumbnailMatch) {
                          thumbnailValue = thumbnailMatch[1];
                        } else {
                          // 기본값으로 "1" 사용
                          thumbnailValue = "1";
                        }
                      }
                    }

                    const payload: CreateRoomRequest = {
                      userId,
                      username: username || "",
                      matchName: title.trim(),
                      roomType,
                      hallId,
                      hallType: "PRESET",
                      difficulty: difficultyValue,
                      maxUserCount,
                      totalSeat,
                      botCount: parseInt(botCount, 10),
                      reservationDay,
                      gameStartTime,
                      thumbnailType,
                      thumbnailValue,
                    };

                    console.log("🚀 방 생성 요청 시작");
                    console.log("📦 요청 바디:", JSON.stringify(payload, null, 2));
                    if (thumbnailFile) {
                      console.log("📎 썸네일 파일:", {
                        name: thumbnailFile.name,
                        size: thumbnailFile.size,
                        type: thumbnailFile.type,
                      });
                    }

                    const response = await createRoom(payload, thumbnailFile || undefined);
                    
                    console.log("✅ 방 생성 성공!");
                    console.log("📥 응답 데이터:", JSON.stringify(response, null, 2));
                    console.log("🆔 생성된 방 ID:", response.roomId);
                    
                    // 성공 시 방으로 이동 (응답 데이터와 요청 데이터를 location state로 전달)
                    if (response.roomId) {
                      const roomPath = paths.iTicketRoom(response.roomId);
                      console.log(`📍 방으로 이동: ${roomPath}`);
                      onClose();
                      navigate(roomPath, {
                        state: { 
                          roomData: response,
                          roomRequest: payload, // 요청 데이터도 함께 전달 (matchName, difficulty 등)
                        },
                      });
                    } else {
                      console.warn("⚠️ 응답에 roomId가 없습니다:", response);
                    }
                  } catch (error) {
                    console.error("❌ 방 생성 실패:", error);
                    if (error instanceof Error) {
                      console.error("에러 메시지:", error.message);
                      console.error("에러 스택:", error.stack);
                    }
                    alert(error instanceof Error ? error.message : "방 생성에 실패했습니다.");
                  } finally {
                    setIsCreating(false);
                    console.log("🏁 방 생성 프로세스 종료");
                  }
                }}
                className={`px-4 py-1.5 rounded-md font-semibold ${
                  canFinalize && !isCreating
                    ? "bg-purple-600 text-white hover:bg-purple-700 cursor-pointer"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                }`}
              >
                {isCreating ? "생성 중..." : "방만들기"}
              </button>
            </>
          )}
        </div>

        {thumbPickerOpen ? (
          <ThumbnailSelectModal
            open={thumbPickerOpen}
            onClose={() => setThumbPickerOpen(false)}
            thumbnails={thumbnails}
            onSelect={(src) => {
              setThumbnailUrl(src);
              setThumbnailFile(null); // 프리셋 선택 시 파일 초기화
              setThumbPickerOpen(false);
            }}
            onUploadClick={triggerUpload}
          />
        ) : null}

        <Snackbar
          open={toastOpen}
          autoHideDuration={2000}
          onClose={() => setToastOpen(false)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert
            onClose={() => setToastOpen(false)}
            severity="error"
            variant="filled"
            sx={{ width: "100%" }}
          >
            jpg, png 파일만 업로드 가능합니다.
          </Alert>
        </Snackbar>
      </div>
    </div>
  );
}

function TitleWithInfo() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xl">방 만들기</span>
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
        className="grid h-6 w-6 place-items-center rounded-full bg-purple-600 text-white shadow-md focus:outline-none cursor-pointer"
      >
        <InfoOutlined sx={{ fontSize: 14 }} />
      </button>
      <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/4 whitespace-nowrap rounded-xl bg-white px-3 py-2 text-[13px] text-gray-900 shadow-[0_6px_16px_rgba(0,0,0,0.12)] border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
        <span>
          <b className="text-purple-600">AI 봇</b>이 경기에 참여해 실제와 같은
          티켓팅을 연습할 수 있습니다.
        </span>
      </div>
    </div>
  );
}

// ThumbnailSelectModal moved to ./ThumbnailSelectModal

// Toast extracted to shared component
