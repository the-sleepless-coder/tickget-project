import { useState, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import googleIcon from "@shared/images/icons/google.png";
import { testAccountLogin, adminAccountLoginByName } from "@features/auth/api";
import { useAuthStore } from "@features/auth/store";

const BASE_URL = `${import.meta.env.VITE_API_ORIGIN ?? ""}/api/v1/dev/auth`;

export default function SocialLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "warning" | "info";
  }>({ open: false, message: "", severity: "info" });
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const openSnackbar = (
    message: string,
    severity: "success" | "error" | "warning" | "info" = "info"
  ) => setSnackbar({ open: true, message, severity });

  const oauthHandledRef = useRef(false);

  const trySetAuthFromMessage = (data: unknown) => {
    try {
      const record =
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : null;
      const href = typeof record?.href === "string" ? record.href : null;
      if (!href) return;

      // 상대 경로인 경우 절대 경로로 변환
      let url: URL | null = null;
      try {
        url = new URL(href);
      } catch {
        // 상대 경로인 경우 현재 origin과 결합
        try {
          url = new URL(href, window.location.origin);
        } catch {
          return;
        }
      }

      const params = url ? url.searchParams : null;
      if (!params) return;

      const accessToken =
        params.get("accessToken") || params.get("token") || null;
      if (!accessToken) return;

      const refreshToken = params.get("refreshToken");
      const userIdParam = params.get("userId");
      const userId =
        userIdParam !== null && !Number.isNaN(Number(userIdParam))
          ? Number(userIdParam)
          : 0;
      const email = params.get("email") ?? "";
      const nickname = params.get("nickname") ?? "";
      const name = params.get("name") ?? "";
      const needsProfileParam = params.get("needsProfile");
      const needsProfile = needsProfileParam === "true";

      setAuth({
        accessToken,
        refreshToken,
        userId,
        email,
        nickname,
        name,
        message: "OAuth login",
      });

      // 분기: needsProfile=true면 추가정보 입력으로 이동, 아니면 성공 처리 (홈으로 이동)
      oauthHandledRef.current = true;
      if (needsProfile) {
        openSnackbar("구글 인증이 완료되었습니다.", "success");
        // 추가정보 페이지로 이동 (백엔드가 /signup/additional-info로 리다이렉트해도 /auth/signup으로 변환)
        navigate("/auth/signup", { replace: true });
      } else {
        // needsProfile=false이면 로그인/회원가입 모두 홈으로 이동
        openSnackbar("인증이 완료되었습니다.", "success");
        const from =
          (location.state as { from?: { pathname?: string } })?.from
            ?.pathname || "/";
        navigate(from, { replace: true });
      }
    } catch {
      // ignore parse errors
    }
  };

  const handleSocialLogin = async (provider: "google") => {
    setIsLoading(provider);

    try {
      // OAuth 인증 URL로 리다이렉트
      const oauthUrls = {
        google: BASE_URL + "/oauth2/authorization/google",
      };

      // 새 창에서 OAuth 인증 페이지 열기
      const authWindow = window.open(
        oauthUrls[provider],
        "oauth",
        "width=500,height=600,scrollbars=yes,resizable=yes"
      );

      // 팝업이 차단되었거나 생성에 실패한 경우 처리
      if (!authWindow) {
        openSnackbar(
          "팝업이 차단되었어요. 팝업을 허용한 뒤 다시 시도해주세요.",
          "warning"
        );
        setIsLoading(null);
        return;
      }

      // OAuth 창에서 `/oauth-callback.html` 페이지로 이동하면 인증 결과를 확인
      let timeoutId: number | null = null;
      const onMessage = (event: MessageEvent) => {
        // 보안: origin 검증 (로컬 개발 환경에서는 완화)
        const allowedOrigins = [
          window.location.origin,
          "https://tickget.kr",
          "http://localhost:5173",
          "http://localhost:3000",
        ];
        // oauth-callback.html에서 "*"로 보내지만, 실제 origin도 검증
        if (
          event.origin &&
          !allowedOrigins.some(
            (origin) =>
              event.origin === origin || event.origin.startsWith(origin)
          )
        ) {
          console.warn("OAuth callback from unexpected origin:", event.origin);
          return;
        }

        if (event.data?.type === "oauth-callback") {
          trySetAuthFromMessage(event.data);
          window.removeEventListener("message", onMessage);
          // 콜백을 받았으므로 타임아웃 정리
          if (timeoutId !== null) window.clearTimeout(timeoutId);
          // trySetAuthFromMessage에서 이미 처리했으면 checkAuthStatus 호출하지 않음
          if (!oauthHandledRef.current) {
            checkAuthStatus(false);
          }
        }
      };

      window.addEventListener("message", onMessage);

      // COOP 정책으로 인해 window.closed 체크가 차단되므로 제거
      // postMessage와 타임아웃으로만 처리
      // 팝업이 사용자에 의해 닫혔는지 확인하기 위한 대안:
      // postMessage 이벤트가 발생하지 않고 타임아웃이 지나면 정리됨

      // 타임아웃 설정 (5분 후 자동 정리)
      timeoutId = window.setTimeout(
        () => {
          window.removeEventListener("message", onMessage);
          setIsLoading(null);
        },
        5 * 60 * 1000
      );
    } catch {
      openSnackbar(`${provider} 로그인 중 오류가 발생했습니다.`, "error");
      setIsLoading(null);
    }
  };

  const handleSocialSignup = async (provider: "google") => {
    setIsLoading(provider);

    try {
      // OAuth 인증 URL로 리다이렉트
      const oauthUrls = {
        google: BASE_URL + "/oauth2/authorization/google",
      };

      // 새 창에서 OAuth 인증 페이지 열기
      const authWindow = window.open(
        oauthUrls[provider],
        "oauth",
        "width=500,height=600,scrollbars=yes,resizable=yes"
      );

      // 팝업이 차단되었거나 생성에 실패한 경우 처리
      if (!authWindow) {
        openSnackbar(
          "팝업이 차단되었어요. 팝업을 허용한 뒤 다시 시도해주세요.",
          "warning"
        );
        setIsLoading(null);
        return;
      }

      // OAuth 창에서 `/oauth-callback.html` 페이지로 이동하면 인증 결과를 확인
      let timeoutId: number | null = null;
      const onMessage = (event: MessageEvent) => {
        // 보안: origin 검증 (로컬 개발 환경에서는 완화)
        const allowedOrigins = [
          window.location.origin,
          "https://tickget.kr",
          "http://localhost:5173",
          "http://localhost:3000",
        ];
        // oauth-callback.html에서 "*"로 보내지만, 실제 origin도 검증
        if (
          event.origin &&
          !allowedOrigins.some(
            (origin) =>
              event.origin === origin || event.origin.startsWith(origin)
          )
        ) {
          console.warn("OAuth callback from unexpected origin:", event.origin);
          return;
        }

        if (event.data?.type === "oauth-callback") {
          trySetAuthFromMessage(event.data);
          window.removeEventListener("message", onMessage);
          // 콜백을 받았으므로 타임아웃 정리
          if (timeoutId !== null) window.clearTimeout(timeoutId);
          // trySetAuthFromMessage에서 이미 처리했으면 checkAuthStatus 호출하지 않음
          if (!oauthHandledRef.current) {
            checkAuthStatus(true);
          }
        }
      };

      window.addEventListener("message", onMessage);

      // COOP 정책으로 인해 window.closed 체크가 차단되므로 제거
      // postMessage와 타임아웃으로만 처리
      // 팝업이 사용자에 의해 닫혔는지 확인하기 위한 대안:
      // postMessage 이벤트가 발생하지 않고 타임아웃이 지나면 정리됨

      // 타임아웃 설정 (5분 후 자동 정리)
      timeoutId = window.setTimeout(
        () => {
          window.removeEventListener("message", onMessage);
          setIsLoading(null);
        },
        5 * 60 * 1000
      );
    } catch {
      openSnackbar(`${provider} 회원가입 중 오류가 발생했습니다.`, "error");
      setIsLoading(null);
    }
  };

  const checkAuthStatus = async (isSignup: boolean = false) => {
    try {
      // 실제 구현에서는 사용자 상태를 조회하여 분기 처리하세요.
      if (isSignup) {
        openSnackbar("구글 인증이 완료되었습니다!", "success");
        navigate("/auth/signup", { replace: true });
      } else {
        openSnackbar("로그인이 성공했습니다!", "success");
        const from =
          (location.state as { from?: { pathname?: string } })?.from
            ?.pathname || "/";
        navigate(from, { replace: true });
      }
    } catch {
      // 실패 시 스낵바만 표시
      openSnackbar("인증 상태 확인에 실패했습니다.", "error");
    }
  };

  const handleLogoClick = () => {
    navigate("/");
  };

  const setAuth = useAuthStore((state) => state.setAuth);

  const handleTestAccountCreate = async () => {
    setIsLoading("test");
    try {
      const data = await testAccountLogin();
      console.log("API 응답 데이터:", data);
      setAuth(data);
      const storeState = useAuthStore.getState();
      console.log("저장된 Store 상태:", {
        accessToken: storeState.accessToken
          ? `${storeState.accessToken.substring(0, 20)}...`
          : null,
        nickname: storeState.nickname,
        email: storeState.email,
        userId: storeState.userId,
      });
      openSnackbar("테스트 계정이 생성되었습니다!", "success");
      const from =
        (location.state as { from?: { pathname?: string } })?.from?.pathname ||
        "/";
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 1500);
    } catch (error) {
      console.error("테스트 계정 생성 오류:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "테스트 계정 생성 중 오류가 발생했습니다.";
      openSnackbar(errorMessage, "error");
    } finally {
      setIsLoading(null);
    }
  };

  const handleAdminButtonClick = () => {
    setAdminModalOpen(true);
  };

  const handleAdminAccountSelect = async (name: string) => {
    setIsLoading(`admin-${name}`);
    setAdminModalOpen(false);
    try {
      const data = await adminAccountLoginByName(name);
      console.log(`${name} 관리자 계정 API 응답 데이터:`, data);
      setAuth(data);
      const storeState = useAuthStore.getState();
      console.log("저장된 Store 상태:", {
        accessToken: storeState.accessToken
          ? `${storeState.accessToken.substring(0, 20)}...`
          : null,
        nickname: storeState.nickname,
        email: storeState.email,
        userId: storeState.userId,
      });
      openSnackbar(`${name} 관리자 계정으로 로그인되었습니다!`, "success");
      const from =
        (location.state as { from?: { pathname?: string } })?.from?.pathname ||
        "/";
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 1500);
    } catch (error) {
      console.error(`${name} 관리자 계정 생성 오류:`, error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "관리자 계정 생성 중 오류가 발생했습니다.";
      openSnackbar(errorMessage, "error");
    } finally {
      setIsLoading(null);
    }
  };

  const adminNames = ["승수", "유나", "채준", "재석", "휘", "종환", "재원"];

  const socialButtons = [
    {
      provider: "google" as const,
      icon: <img src={googleIcon} alt="Google" className="w-5 h-5" />,
      text: "구글 계정으로 로그인",
      bgColor: "#ffffff",
      textColor: "#000000",
    },
  ];

  return (
    // 전체 컨테이너
    <div
      className="fixed inset-0 flex flex-col"
      style={{ backgroundColor: "#E9EBF4" }}
    >
      {/* 관리자 계정 선택 버튼 */}
      <div className="fixed top-1.5 right-1.5 z-50" style={{ zIndex: 9999 }}>
        <Button
          size="small"
          sx={{
            textTransform: "none",
            borderRadius: "8px",
            padding: "8px 16px",
            fontSize: "0.875rem",
            fontWeight: 600,
            backgroundColor: "transparent",
            color: "#FFFFFF",
            border: "1px solid transparent",
            "&:hover:not(:disabled)": {
              backgroundColor: "#ef4444",
              color: "#ffffff",
              border: "1px solid #ef4444",
            },
            "&:disabled": {
              backgroundColor: "transparent",
              color: "#FFFFFF",
              border: "1px solid transparent",
              opacity: 0.5,
            },
          }}
          onClick={handleAdminButtonClick}
          disabled={isLoading !== null}
        >
          관리자 계정
        </Button>
      </div>

      {/* 관리자 계정 선택 모달 */}
      <Dialog
        open={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "16px",
            padding: "24px",
          },
        }}
      >
        <DialogTitle
          sx={{
            textAlign: "center",
            fontSize: "1.5rem",
            fontWeight: 700,
            paddingBottom: "16px",
          }}
        >
          관리자 계정 선택
        </DialogTitle>
        <DialogContent>
          <div className="grid grid-cols-2 gap-3">
            {adminNames.map((name) => (
              <Button
                key={name}
                variant="outlined"
                fullWidth
                onClick={() => handleAdminAccountSelect(name)}
                disabled={isLoading !== null}
                sx={{
                  padding: "16px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  borderRadius: "8px",
                  borderColor: "#e5e7eb",
                  color: "#374151",
                  "&:hover": {
                    borderColor: "#ef4444",
                    backgroundColor: "#fef2f2",
                    color: "#ef4444",
                  },
                }}
              >
                {name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* 헤더 */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="w-full px-5 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <img
                src="/header-logo-violet.svg"
                alt="Tickget"
                className="h-7 w-auto"
              />
            </Link>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* 좌측 배경 이미지 */}
        <div
          className="absolute left-0 top-0 bottom-0 w-full lg:w-1/2 bg-cover bg-no-repeat bg-left-bottom"
          style={{ backgroundImage: "url(/login_bg.png)" }}
        />

        {/* 좌측 로그인 폼 */}
        <div className="relative z-10 flex items-center justify-center w-full lg:w-1/2 px-4 md:px-8 lg:px-12">
          {/* 흰색 카드 */}
          <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm md:max-w-md">
            {/* 로고와 제목 */}
            <div className="text-center mb-8">
              <div
                className="flex justify-center items-center mb-4 cursor-pointer"
                onClick={handleLogoClick}
              >
                <img
                  src="/header-logo-violet.svg"
                  alt="Tickget Logo"
                  className="h-12 w-auto"
                />
              </div>
              <p className="text-gray-600 text-sm">
                서비스 이용을 위해 로그인이 필요합니다.
              </p>
            </div>

            {/* 소셜 로그인 버튼 */}
            <div className="space-y-3 mb-6">
              {socialButtons.map((button) => (
                <Button
                  key={button.provider}
                  size="medium"
                  fullWidth
                  className="h-12 flex items-center justify-center rounded-lg font-medium"
                  sx={{
                    backgroundColor: button.bgColor,
                    color: button.textColor,
                    border: "1px solid #e5e7eb",
                    textTransform: "none",
                    "&:hover": { backgroundColor: "#f9fafb" },
                  }}
                  onClick={() => handleSocialLogin(button.provider)}
                  disabled={isLoading !== null}
                >
                  <div className="mr-3">{button.icon}</div>
                  <span className="text-sm">{button.text}</span>
                </Button>
              ))}

              {/* 테스트 계정 생성 버튼 */}
              <Button
                size="medium"
                fullWidth
                className="h-12 flex items-center justify-center rounded-lg font-medium !bg-c-purple-250 hover:!bg-c-purple-300 !text-white"
                sx={{
                  textTransform: "none",
                }}
                onClick={handleTestAccountCreate}
                disabled={isLoading !== null}
              >
                <span className="text-sm">테스트 계정 생성</span>
              </Button>
            </div>

            {/* 회원가입 링크 */}
            <div className="text-center mb-8">
              <button
                onClick={() => handleSocialSignup("google")}
                disabled={isLoading !== null}
                className="text-sm text-gray-600 hover:text-gray-800 underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                회원가입 하러가기
              </button>
            </div>

            {/* 하단 저작권 정보 */}
            <div className="text-center text-xs text-gray-500 space-y-1">
              <p>© 2025 Tickget, All Right reserved</p>
              <p>
                <a href="#" className="hover:text-gray-700">
                  Terms of Use
                </a>
                {" · "}
                <a href="#" className="hover:text-gray-700">
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* 우측 비디오 영역 */}
        <div
          className="hidden lg:flex lg:w-1/2 items-stretch justify-center overflow-hidden"
          style={{ backgroundColor: "#E9EBF4" }}
        >
          <video
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-auto object-contain object-center outline-none"
            style={{ border: "none", outline: "none" }}
          >
            <source src="/tickget.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
