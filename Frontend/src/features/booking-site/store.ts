import { create } from "zustand";
import { persist } from "zustand/middleware";

interface MatchState {
  matchId: number | null;
  setMatchId: (matchId: number) => void;
  clearMatch: () => void;
  getMatchId: () => number | null;
}

export const useMatchStore = create<MatchState>()(
  persist(
    (set, get) => ({
      matchId: null,
      setMatchId: (matchId: number) => {
        set({ matchId });
        
      },
      clearMatch: () => {
        set({ matchId: null });
        
      },
      getMatchId: () => get().matchId,
    }),
    {
      name: "match-storage",
    }
  )
);

// 개발 편의를 위한 글로벌 접근 (dev 전용)
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as any).matchStore = useMatchStore;
}
