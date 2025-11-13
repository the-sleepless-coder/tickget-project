export interface ConcertHall {
  id: string;
  name: string;
  totalSeat: number;
  score?: number;
}

export interface SearchResponse {
  total: number;
  took: number;
  results: ConcertHall[];
}

export interface SearchParams {
  q: string;
  size?: number;
}
