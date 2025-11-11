import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AIState {
  capacity: number | null;
  generating: boolean;
  resultTsxUrl: string | null;
  resultMetaUrl: string | null;
  hallId: number | null;
  error: string | null;
  imageBase64: string | null;
  setCapacity: (n: number | null) => void;
  setGenerating: (b: boolean) => void;
  setResult: (v: {
    tsxUrl: string | null;
    metaUrl: string | null;
    hallId: number | null;
  }) => void;
  setError: (msg: string | null) => void;
  setImageBase64: (b64: string | null) => void;
}

export const useAIStore = create<AIState>()(
  persist(
    (set) => ({
      capacity: null,
      generating: false,
      resultTsxUrl: null,
      resultMetaUrl: null,
      hallId: null,
      error: null,
      imageBase64: null,
      setCapacity: (n) => set({ capacity: n }),
      setGenerating: (b) => set({ generating: b }),
      setResult: (v) =>
        set({
          resultTsxUrl: v.tsxUrl,
          resultMetaUrl: v.metaUrl,
          hallId: v.hallId,
        }),
      setError: (msg) => set({ error: msg }),
      setImageBase64: (b64) => set({ imageBase64: b64 }),
    }),
    { name: "ai-storage" }
  )
);

// 개발 편의를 위한 글로벌 접근 (dev 전용)
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as Window & { aiStore?: typeof useAIStore }).aiStore = useAIStore;
}
