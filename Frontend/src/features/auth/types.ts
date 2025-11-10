export interface TestAccountLoginResponse {
  accessToken: string;
  refreshToken: string | null;
  userId: number;
  email: string;
  nickname: string;
  name: string;
  message: string;
}
