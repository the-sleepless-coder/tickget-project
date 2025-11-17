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
}

export interface MatchSpecifics {
  userId: number;
  userName: string;
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
  totalRank: number;
  totalTime: number;
  queueTimeDifference: number;
  queueMissCountDifference: number;
  captchaBackSpaceCountDifference: number;
  captchaTimeDifference: number;
  seatClickMissDifference: number;
  seatSelectTimeDifference: number;
  seatTrialCountDifference: number;
}

export interface MatchDataResponse {
  matchInfo: MatchInfo;
  specifics: MatchSpecifics[];
}

// AI 분석 API 응답 타입
export interface UserReportLLMResponse {
  text: string;
}
