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
}: {
  step: 1 | 2;
  thumbnailUrl: string | null;
  onThumbnailChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onPresetClick: () => void;
  onUploadClick: () => void;
  layoutUrl: string | null;
  onLayoutChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  if (step === 1) {
    return (
      <div className="flex flex-col">
        <label htmlFor="room-thumbnail" className="cursor-pointer">
          <div className="grid place-items-center rounded-md bg-gray-200 w-[240px] h-[320px] md:w-[260px] md:h-[347px] mx-auto md:mx-0 overflow-hidden">
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
        <div className="mt-2 flex items-center justify-between text-sm text-gray-700">
          <button
            type="button"
            onClick={onPresetClick}
            className="hover:text-gray-900"
          >
            프리셋 선택
          </button>
          <button
            type="button"
            onClick={onUploadClick}
            className="hover:text-gray-900"
          >
            사진 업로드
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <label htmlFor="room-layout" className="cursor-pointer block">
        <div className="grid place-items-center rounded-md bg-gray-200 w-full h-[300px] md:h-[420px] overflow-hidden">
          {layoutUrl ? (
            <img
              src={layoutUrl}
              alt="배치도 미리보기"
              className="w-full h-full object-cover"
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
          )}
        </div>
      </label>
      <input
        id="room-layout"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onLayoutChange}
      />
    </div>
  );
}
