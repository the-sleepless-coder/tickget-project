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
  profileImageUrl: string | null;
  profileImageUploaded: number; // 프로필 이미지 업로드 완료 시각 (타임스탬프)
  setAuth: (data: TestAccountLoginResponse) => void;
  clearAuth: () => void;
  getAuthHeaders: () => Record<string, string>;
  triggerProfileImageRefresh: () => void; // 프로필 이미지 캐시 무효화 트리거
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
      profileImageUrl: null,
      profileImageUploaded: 0,

      setAuth: (data) => {
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          userId: data.userId,
          email: data.email,
          nickname: data.nickname,
          name: data.name,
          profileImageUrl: data.profileImageUrl ?? null,
        });
        // 개발 환경에서 store 상태 확인용
        // if (import.meta.env.DEV) {
        //   console.log("Auth Store 업데이트:", {
        //     accessToken: data.accessToken
        //       ? `${data.accessToken.substring(0, 20)}...`
        //       : null,
        //     refreshToken: data.refreshToken
        //       ? `${data.refreshToken.substring(0, 20)}...`
        //       : null,
        //     userId: data.userId,
        //     email: data.email,
        //     nickname: data.nickname,
        //     name: data.name,
        //     profileImageUrl: data.profileImageUrl,
        //   });
        // }
      },

      clearAuth: () => {
        set({
          accessToken: null,
          refreshToken: null,
          userId: null,
          email: null,
          nickname: null,
          name: null,
          profileImageUrl: null,
          profileImageUploaded: 0,
        });
      
      },

      getAuthHeaders: (): Record<string, string> => {
        const { accessToken } = get();
        if (!accessToken) {
          return {} as Record<string, string>;
        }
        return {
          Authorization: `Bearer ${accessToken}`,
        };
      },

      triggerProfileImageRefresh: () => {
        set({ profileImageUploaded: Date.now() });
      },
    }),
    {
      name: "auth-storage", // localStorage에 저장될 키 이름
      // accessToken만 저장하고 refreshToken은 쿠키에 있으므로 제외할 수도 있지만,
      // 일단 모두 저장하도록 설정
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        userId: state.userId,
        email: state.email,
        nickname: state.nickname,
        name: state.name,
        profileImageUrl: state.profileImageUrl,
        // profileImageUploaded는 세션 동안만 유지되므로 제외
      }),
    }
  )
);

// 개발 환경에서 브라우저 콘솔에서 store 확인 가능하도록
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as any).authStore = useAuthStore;
}
