import type {
  SearchResponse,
  ConcertHall,
  SearchParams,
} from "@/shared/types/search.types";

const BASE_URL =
  import.meta.env.VITE_SEARCH_API_URL || "https://tickget.kr/api/v1/dev/search";

export const searchApi = {
  /**
   * 공연장 검색 (자동완성)
   */
  searchConcertHalls: async (params: SearchParams): Promise<SearchResponse> => {
    const queryParams = new URLSearchParams({
      q: params.q,
      ...(params.size && { size: params.size.toString() }),
    });

    const response = await fetch(`${BASE_URL}/concerts/halls?${queryParams}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Search failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  },

  /**
   * 공연장 상세 조회
   */
  getConcertHallById: async (id: string): Promise<ConcertHall> => {
    const response = await fetch(`${BASE_URL}/concerts/halls/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Fetch failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  },
};
