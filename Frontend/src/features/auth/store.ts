import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TestAccountLoginResponse } from "./types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: number | null;
  email: string | null;
  nickname: string | null;
  name: string | null;
  setAuth: (data: TestAccountLoginResponse) => void;
  clearAuth: () => void;
  getAuthHeaders: () => Record<string, string>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      email: null,
      nickname: null,
      name: null,

      setAuth: (data) => {
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          userId: data.userId,
          email: data.email,
          nickname: data.nickname,
          name: data.name,
        });
        // 개발 환경에서 store 상태 확인용
        if (import.meta.env.DEV) {
          console.log("Auth Store 업데이트:", {
            accessToken: data.accessToken
              ? `${data.accessToken.substring(0, 20)}...`
              : null,
            refreshToken: data.refreshToken
              ? `${data.refreshToken.substring(0, 20)}...`
              : null,
            userId: data.userId,
            email: data.email,
            nickname: data.nickname,
            name: data.name,
          });
        }
      },

      clearAuth: () => {
        set({
          accessToken: null,
          refreshToken: null,
          userId: null,
          email: null,
          nickname: null,
          name: null,
        });
        if (import.meta.env.DEV) {
          console.log("✅ Auth Store 초기화됨");
        }
      },

      getAuthHeaders: () => {
        const { accessToken } = get();
        if (!accessToken) {
          return {};
        }
        return {
          Authorization: `Bearer ${accessToken}`,
        };
      },
    }),
    {
      name: "auth-storage", // localStorage에 저장될 키 이름
      // accessToken만 저장하고 refreshToken은 쿠키에 있으므로 제외할 수도 있지만,
      // 일단 모두 저장하도록 설정
    }
  )
);

// 개발 환경에서 브라우저 콘솔에서 store 확인 가능하도록
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as any).authStore = useAuthStore;
  console.log(
    "개발자 도구에서 store 확인: window.authStore.getState() 또는 window.authStore"
  );
}
