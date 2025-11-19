export interface QueueClickStat {
  date: string;
  clickTime: number;
  missCount: number;
}

export interface CaptchaClickStat {
  date: string;
  selectTime: number;
  backSpace: number;
  missCount: number;
}

export interface SeatReserveClickStat {
  date: string;
  selectTime: number;
  missCount: number;
}

export interface ClickStats {
  queueClick: QueueClickStat[];
  catpchaClick: CaptchaClickStat[];
  seatReserveClick: SeatReserveClickStat[];
}

export interface SpecificsListItem {
  date: string;
  gameType: "MULTI" | "SOLO";
  userRank: number;
  totRank: number;
  userTotCount: number | null;
  playerTotCount: number;
  queueClickTime: number;
  captchaClickTime: number;
  seatClickTime: number;
  totalDuration: number;
}

export interface MyPageStatsResponse {
  userId: number;
  clickStats: ClickStats;
  specificsList: SpecificsListItem[];
}

// 마이페이지 랭킹/퍼센타일 조회 API 응답 타입
export interface RankingPercentileItem {
  dateInfo: string; // "2025.11.19 17:15" 형태
  percentile: number; // 퍼센타일 값 (0~100)
  points: number; // 점수
}

export interface RankingPercentileResponse {
  userId: number;
  userNickName: string;
  seasonInfo: string; // 예: "11월 넷째 주"
  avgPercentile: number; // 평균 퍼센타일
  percentileData: RankingPercentileItem[];
}

// 경기 기록 API 응답 타입
export interface MatchInfo {
  matchId: number;
  matchName: string;
  roomType: "SOLO" | "MULTI";
  userTotCount: number | null;
  hallName: string;
  isAIGenerated: boolean;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  totalSeat: number;
  botCount: number;
  startedAt: string; // ISO 8601 형식
  userSuccess: boolean;
  tsxUrl?: string | null; // AI 생성된 경우 TSX URL
}

export interface MatchSpecifics {
  userId: number;
  userNickname: string;
  hallId: number;
  roomType: "SOLO" | "MULTI";
  selectedSection: string;
  selectedSeat: string;
  matchId: number;
  queueMissCount: number;
  queueSelectTime: number;
  captchaBackspaceCount: number;
  captchaSelectTime: number;
  captchaTrialCount: number;
  seatSelectClickMissCount: number;
  seatSelectTime: number;
  seatSelectTrialCount: number;
  // 백엔드 응답: 전체 순위 및 유저 랭크
  userTotalRank: number; // 경기 내 전체 순위 (봇 + 사람)
  userRank: number; // 유저 랭크 (사용자들 중 순위)
  totalTime: number;
  queueTimeDifference: number;
  queueMissCountDifference: number;
  captchaBackSpaceCountDifference: number;
  captchaTimeDifference: number;
  seatClickMissDifference: number;
  seatSelectTimeDifference: number;
  seatTrialCountDifference: number;
  tsxUrl?: string | null; // AI 생성된 경우 TSX URL
}

export interface MatchDataResponse {
  matchInfo: MatchInfo;
  specifics: MatchSpecifics[];
}

// AI 분석 API 응답 타입
export interface UserReportLLMResponse {
  text: string;
}
