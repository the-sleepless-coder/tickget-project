import { createHttpClient } from "@shared/lib/http";
import type { TestAccountLoginResponse } from "./types";

// 환경별 공통 프리픽스 (예: /api/v1 또는 /api/v1/dev)
const AUTH_BASE_URL = `${import.meta.env.VITE_API_ORIGIN ?? ""}${
  import.meta.env.VITE_API_PREFIX ?? (import.meta.env.DEV ? "/api/v1/dev" : "/api/v1")
}`;

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
