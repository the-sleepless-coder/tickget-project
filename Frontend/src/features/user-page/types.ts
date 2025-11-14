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
