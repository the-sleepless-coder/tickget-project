import type { ChangeEvent } from "react";
import { useState } from "react";
import Loader from "../shared/Loader";
import InsertPhotoOutlined from "@mui/icons-material/InsertPhotoOutlined";
import { Alert, Snackbar } from "@mui/material";
import TsxPreview from "@/pages/user-page/_components/TsxPreview";

export default function LeftPane({
  step,
  thumbnailUrl,
  onThumbnailChange,
  onPresetClick,
  onUploadClick,
  layoutUrl,
  onLayoutChange,
  size,
  venue,
  isAIMode,
  isPresetMode,
  showLoader,
  tsxUrl,
  hasGenerated,
  onReset,
}: {
  step: 1 | 2;
  thumbnailUrl: string | null;
  onThumbnailChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onPresetClick: () => void;
  onUploadClick: () => void;
  layoutUrl: string | null;
  onLayoutChange: (e: ChangeEvent<HTMLInputElement>) => void;
  size: "소형" | "중형" | "대형";
  venue: string;
  isAIMode?: boolean;
  isPresetMode?: boolean;
  showLoader?: boolean;
  tsxUrl?: string | null;
  hasGenerated?: boolean;
  onReset?: () => void;
}) {
  const [toastOpen, setToastOpen] = useState(false);
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

  const handleThumbnailChangeWithSizeCheck = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setToastOpen(true);
      e.target.value = "";
      return;
    }
    onThumbnailChange(e);
  };

  const handleLayoutChangeWithSizeCheck = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setToastOpen(true);
      e.target.value = "";
      return;
    }
    onLayoutChange(e);
  };
  if (step === 1) {
    return (
      <div className="flex flex-col">
        <label htmlFor="room-thumbnail" className="cursor-pointer">
          <div className="grid place-items-center rounded-md bg-gray-200 w-[230px] h-[307px] md:w-[230px] md:h-[307px] mx-auto md:mx-0 overflow-hidden">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt="썸네일 미리보기"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="grid h-12 w-12 place-items-center text-gray-500">
                  <InsertPhotoOutlined sx={{ fontSize: 48 }} />
                </div>
                <div className="text-gray-500 mt-1 text-sm font-medium">
                  방 썸네일을 <br />
                  업로드할 수 있습니다
                </div>
              </div>
            )}
          </div>
        </label>
        <input
          id="room-thumbnail"
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          className="hidden"
          onChange={handleThumbnailChangeWithSizeCheck}
        />
        <div className="mt-2 flex items-center justify-between text-sm text-gray-700">
          <button
            type="button"
            onClick={onPresetClick}
            className="cursor-pointer"
          >
            썸네일 선택
          </button>
          <button
            type="button"
            onClick={onUploadClick}
            className="cursor-pointer"
          >
            사진 업로드
          </button>
        </div>
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
            이미지 크기가 너무 큽니다. (10MB 이하 업로드)
          </Alert>
        </Snackbar>
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-col">
      <label
        htmlFor={isPresetMode || hasGenerated ? undefined : "room-layout"}
        className={`block w-[230px] ${isPresetMode || hasGenerated ? "cursor-default" : "cursor-pointer"}`}
      >
        <div className="relative grid place-items-center rounded-md bg-gray-200 w-[230px] h-[307px] md:w-[230px] md:h-[307px] overflow-hidden">
          {(() => {
            const defaultSrc =
              size === "소형" || /샤롯데/.test(venue)
                ? "/performance-halls/charlotte-theater.jpg"
                : size === "중형" || /올림픽홀/.test(venue)
                  ? "/performance-halls/olympic-hall.jpg"
                  : size === "대형" || /인스파이어아레나/.test(venue)
                    ? "/performance-halls/inspire-arena.jpg"
                    : null;
            const src = isPresetMode
              ? defaultSrc
              : layoutUrl || (isAIMode ? null : defaultSrc);
            if (isAIMode && tsxUrl) {
              return (
                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                  <TsxPreview
                    key={`create-room-${tsxUrl}`}
                    src={tsxUrl}
                    className="w-full h-full"
                    disableAutoScale={false}
                    overflowHidden={true}
                  />
                </div>
              );
            }
            return src ? (
              <img
                src={src}
                alt="배치도 미리보기"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center text-gray-500">
                  <InsertPhotoOutlined sx={{ fontSize: 48 }} />
                </div>
                <div className="text-gray-600 mt-2 text-sm font-medium">
                  배치도를 업로드해주세요
                </div>
              </div>
            );
          })()}
          {showLoader ? (
            <div className="absolute inset-0 bg-black/10">
              <Loader />
            </div>
          ) : null}
        </div>
      </label>
      {!isPresetMode && !hasGenerated && (
        <input
          id="room-layout"
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          className="hidden"
          onChange={handleLayoutChangeWithSizeCheck}
          disabled={hasGenerated}
        />
      )}
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
          이미지 크기가 너무 큽니다. (5MB 이하 업로드)
        </Alert>
      </Snackbar>
    </div>
  );
}
