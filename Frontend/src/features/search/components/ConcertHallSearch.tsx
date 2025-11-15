import { useState, useEffect, useRef } from "react";
import { searchApi } from "@/shared/api/searchApi";
import type { ConcertHall } from "@/shared/types/search.types";

interface ConcertHallSearchProps {
  onSelect?: (hall: ConcertHall | null) => void;
  placeholder?: string;
  selectedHall?: ConcertHall | null;
}

export const ConcertHallSearch = ({
  onSelect,
  placeholder = "공연장을 검색하세요",
  selectedHall,
}: ConcertHallSearchProps) => {
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<ConcertHall[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce 검색어 (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
    }, 200);

    return () => clearTimeout(timer); // Cleanup: 이전 타이머 취소
  }, [keyword]);

  // 검색 API 호출
  useEffect(() => {
    if (debouncedKeyword.trim().length === 0) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const search = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await searchApi.searchConcertHalls({
          q: debouncedKeyword,
          size: 20,
        });
        setResults(data.results);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "검색 중 오류가 발생했습니다."
        );
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    search();
  }, [debouncedKeyword]);

  // 선택된 공연장이 변경되면 입력값 업데이트
  useEffect(() => {
    if (selectedHall) {
      setKeyword(selectedHall.name);
    }
  }, [selectedHall]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setKeyword(value);
    setIsOpen(value.length > 0);
    // 검색어가 변경되면 선택 해제
    if (selectedHall && value !== selectedHall.name) {
      onSelect?.(null);
    }
  };

  const handleSelect = (hall: ConcertHall) => {
    setKeyword(hall.name);
    setIsOpen(false);
    onSelect?.(hall);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* 검색 입력창 */}
      <div className="relative">
        <input
          type="text"
          value={keyword}
          onChange={handleInputChange}
          onFocus={() => keyword.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full rounded-none border border-gray-300 px-5 py-2.5 ${
            selectedHall ? "pr-20" : "pr-10"
          } text-gray-700 placeholder:text-gray-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 bg-white`}
        />
        {selectedHall && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded-full whitespace-nowrap">
            선택됨
          </span>
        )}
      </div>

      {/* 자동완성 드롭다운 */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {isLoading && (
            <div className="p-4 text-center text-gray-500">검색 중...</div>
          )}

          {error && <div className="p-4 text-center text-red-500">{error}</div>}

          {!isLoading &&
            !error &&
            results.length === 0 &&
            debouncedKeyword.trim().length > 0 && (
              <div className="p-4 text-center text-gray-500">
                검색 결과가 없습니다.
              </div>
            )}

          {!isLoading && !error && results.length > 0 && (
            <>
              <div className="p-2 text-xs text-gray-500 border-b">
                {results.length}개 검색 결과
              </div>
              {results.map((hall) => (
                <button
                  key={hall.id}
                  onClick={() => handleSelect(hall)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0 transition-colors"
                >
                  <div className="font-medium text-gray-900">{hall.name}</div>
                  <div className="text-sm text-gray-500">
                    {hall.totalSeat.toLocaleString()}석
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
