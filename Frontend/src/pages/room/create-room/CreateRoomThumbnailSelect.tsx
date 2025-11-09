export default function ThumbnailSelectModal({
  open,
  onClose,
  thumbnails,
  onSelect,
  onUploadClick,
}: {
  open: boolean;
  onClose: () => void;
  thumbnails: string[];
  onSelect: (src: string) => void;
  onUploadClick: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative bg-white rounded-xl shadow-lg w-full max-w-[520px] p-5">
        <div className="text-base font-semibold text-gray-900 mb-3">
          썸네일 선택
        </div>
        <div className="grid grid-cols-3 gap-3">
          {thumbnails.map((src, idx) => (
            <button
              key={idx}
              type="button"
              className="relative aspect-[3/4] overflow-hidden rounded-lg border border-gray-200 hover:border-purple-400"
              onClick={() => onSelect(src)}
            >
              <img
                src={src}
                alt={`썸네일 ${idx + 1}`}
                className="absolute inset-0 h-full w-full object-cover cursor-pointer"
              />
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          {/* <button
            type="button"
            onClick={onUploadClick}
            className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
          >
            사진 업로드
          </button> */}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
