export interface WeeklyRankingItem {
  rank: number;
  userId: number;
  nickName: string;
  imageUrl: string;
  points: number;
}

export interface WeeklyRankingResponse {
  weeklyInfo: string;
  rankingData: WeeklyRankingItem[];
  updatedTime: string;
}
