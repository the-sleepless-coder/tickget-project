import { createHttpClient } from "@shared/lib/http";
import type { TestAccountLoginResponse } from "./types";

// 로그인 서버: /auth 세그먼트 사용
const AUTH_BASE_URL = `${import.meta.env.VITE_API_ORIGIN ?? ""}/api/v1/dev/auth`;

const authApi = createHttpClient(AUTH_BASE_URL);

export const testAccountLogin = async (): Promise<TestAccountLoginResponse> => {
  
  try {
    const result =
      await authApi.postJson<TestAccountLoginResponse>("/test/login");
    return result;
  } catch (error) {
    console.error("testAccountLogin error:", error);
    throw error;
  }
};

export const adminAccountLogin =
  async (): Promise<TestAccountLoginResponse> => {
    
    try {
      const result =
        await authApi.postJson<TestAccountLoginResponse>("/test/admin/login");
      return result;
    } catch (error) {
      console.error("adminAccountLogin error:", error);
      throw error;
    }
  };

export const adminAccountLoginByName = async (
  nickname: string
): Promise<TestAccountLoginResponse> => {
 
  try {
    const result = await authApi.postJson<TestAccountLoginResponse>(
      "/test/admin/login",
      { nickname }
    );
    return result;
  } catch (error) {
    console.error(`adminAccountLoginByName(${nickname}) error:`, error);
    throw error;
  }
};
