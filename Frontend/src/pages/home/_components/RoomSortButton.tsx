import type { ChangeEvent } from "react";

export type SortKeyCommon = "start" | "latest";

interface RoomSortControlsProps {
  activeSort: SortKeyCommon;
  onChange: (key: SortKeyCommon) => void;
}

export default function RoomSortControls({
  activeSort,
  onChange,
}: RoomSortControlsProps) {
  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as SortKeyCommon;
    onChange(value);
  };

  return (
    <div className="relative">
      <select
        value={activeSort}
        onChange={handleChange}
        className="appearance-none rounded-full border border-gray-300 bg-white px-4 py-2 pr-8 text-sm text-gray-900 shadow-sm transition-colors hover:border-purple-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
      >
        <option value="start">시작순</option>
        <option value="latest">최신순</option>
      </select>
      {/* 드롭다운 화살표 아이콘 */}
      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}
