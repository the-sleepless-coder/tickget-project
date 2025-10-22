import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import googleIcon from "@shared/images/icons/google.png";

const BASE_URL = import.meta.env.VITE_API_URL;

export default function SocialLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "warning" | "info";
  }>({ open: false, message: "", severity: "info" });

  const openSnackbar = (
    message: string,
    severity: "success" | "error" | "warning" | "info" = "info"
  ) => setSnackbar({ open: true, message, severity });

  const handleSocialLogin = async (provider: "google") => {
    setIsLoading(provider);

    try {
      let popupCheckIntervalId: number | null = null;
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
      const onMessage = (event: MessageEvent) => {
        if (event.data.type === "oauth-callback") {
          window.removeEventListener("message", onMessage);
          // 콜백을 받았으므로 팝업 닫힘 감시 종료
          if (popupCheckIntervalId !== null)
            window.clearInterval(popupCheckIntervalId);
          checkAuthStatus();
        }
      };

      window.addEventListener("message", onMessage);

      // 팝업이 콜백 없이 닫혔는지 주기적으로 확인
      popupCheckIntervalId = window.setInterval(() => {
        if (authWindow.closed) {
          if (popupCheckIntervalId !== null)
            window.clearInterval(popupCheckIntervalId);
          window.removeEventListener("message", onMessage);
          setIsLoading(null);
        }
      }, 500);
    } catch {
      openSnackbar(`${provider} 로그인 중 오류가 발생했습니다.`, "error");
      setIsLoading(null);
    }
  };

  const checkAuthStatus = async () => {
    try {
      // 실제 구현에서는 사용자 상태를 조회하여 분기 처리하세요.
      openSnackbar("로그인이 성공했습니다!", "success");
      const from =
        (location.state as { from?: { pathname?: string } })?.from?.pathname ||
        "/";
      navigate(from, { replace: true });
    } catch {
      // 실패 시 스낵바만 표시
      openSnackbar("인증 상태 확인에 실패했습니다.", "error");
    }
  };

  const handleLogoClick = () => {
    navigate("/");
  };

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
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      {/* 중앙 흰색 카드 */}
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full mx-4 max-w-sm md:max-w-md lg:max-w-lg">
        {/* 로고와 제목 */}
        <div className="text-center mb-8">
          <div
            className="flex justify-center items-center mb-4 cursor-pointer"
            onClick={handleLogoClick}
          >
            <img
              src="/images/tickget-logo.png"
              alt="Tickget Logo"
              className="h-12 w-auto"
            />
          </div>
          <p className="text-gray-600 text-sm">계속하려면 로그인해주세요.</p>
        </div>

        {/* 소셜 로그인 버튼들 */}
        <div className="space-y-3 mb-8">
          {socialButtons.map((button) => (
            <Button
              key={button.provider}
              size="large"
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
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
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
