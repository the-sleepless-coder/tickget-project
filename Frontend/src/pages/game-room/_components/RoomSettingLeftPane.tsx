import type { ChangeEvent } from "react";
import InsertPhotoOutlined from "@mui/icons-material/InsertPhotoOutlined";

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
}) {
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
          accept="image/*"
          className="hidden"
          onChange={onThumbnailChange}
        />
        <div className="mt-2 flex items-center justify-between text-sm text-gray-700"></div>
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-col">
      <label
        htmlFor={isPresetMode ? undefined : "room-layout"}
        className={`block w-[230px] ${isPresetMode ? "cursor-default" : "cursor-pointer"}`}
      >
        <div className="grid place-items-center rounded-md bg-gray-200 w-[230px] h-[307px] md:w-[230px] md:h-[307px] overflow-hidden">
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
        </div>
      </label>
      {!isPresetMode && (
        <input
          id="room-layout"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onLayoutChange}
        />
      )}
    </div>
  );
}
