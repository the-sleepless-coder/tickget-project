import type { MouseEvent } from "react";

export type SortKeyCommon = "start" | "latest";

interface RoomSortControlsProps {
  activeSort: SortKeyCommon;
  onChange: (key: SortKeyCommon) => void;
}

export default function RoomSortControls({
  activeSort,
  onChange,
}: RoomSortControlsProps) {
  const handleClick =
    (key: SortKeyCommon) => (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (activeSort !== key) onChange(key);
    };

  return (
    <div className="flex gap-3 text-sm">
      <button
        type="button"
        aria-pressed={activeSort === "start"}
        onClick={handleClick("start")}
        className={`rounded-full px-4 py-2 transition-colors cursor-pointer ${
          activeSort === "start"
            ? "text-purple-600 bg-purple-50"
            : "text-gray-900 bg-gray-100"
        }`}
      >
        시작순
      </button>
      <button
        type="button"
        aria-pressed={activeSort === "latest"}
        onClick={handleClick("latest")}
        className={`rounded-full px-4 py-2 transition-colors cursor-pointer ${
          activeSort === "latest"
            ? "text-purple-600 bg-purple-50"
            : "text-gray-900 bg-gray-100"
        }`}
      >
        최신순
      </button>
    </div>
  );
}
