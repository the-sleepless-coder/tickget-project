import { createHttpClient } from "@shared/lib/http";
import type { TestAccountLoginResponse } from "./types";

// 개발 환경에서는 프록시를 사용하므로 상대 경로 사용
// 프로덕션에서는 환경 변수로 설정
const AUTH_BASE_URL =
  import.meta.env.VITE_AUTH_BASE_URL ??
  (import.meta.env.DEV ? "/api/v1/dev" : "https://tickget.kr/api/v1/dev");

const authApi = createHttpClient(AUTH_BASE_URL);

export const testAccountLogin = async (): Promise<TestAccountLoginResponse> => {
  console.log("Request URL:", `${AUTH_BASE_URL}/auth/test/login`);
  try {
    const result =
      await authApi.postJson<TestAccountLoginResponse>("/auth/test/login");
    return result;
  } catch (error) {
    console.error("testAccountLogin error:", error);
    throw error;
  }
};
