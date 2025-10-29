import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

// TODO: OAuth 인증 후 실제로 받아올 사용자 정보
interface OAuthUserInfo {
  email: string;
  name: string;
  picture: string;
}

export default function SignupPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nickname: "",
    birthDate: "",
    profileImage: "",
  });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "warning" | "info";
  }>({ open: false, message: "", severity: "info" });

  // TODO: OAuth 인증 완료 후 실제 사용자 정보 받아오기
  const [userInfo] = useState<OAuthUserInfo>({
    email: "user@example.com", // 실제로는 OAuth에서 받음
    name: "홍길동", // 실제로는 OAuth에서 받음
    picture: "https://via.placeholder.com/150", // 실제로는 OAuth에서 받음
  });

  useEffect(() => {
    // 구글에서 받아온 이름으로 닉네임 기본값 설정
    if (userInfo.name) {
      setFormData((prev) => ({ ...prev, nickname: userInfo.name }));
      setFormData((prev) => ({ ...prev, profileImage: userInfo.picture }));
    }
  }, [userInfo]);

  const openSnackbar = (
    message: string,
    severity: "success" | "error" | "warning" | "info" = "info"
  ) => setSnackbar({ open: true, message, severity });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 파일 크기 체크 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        openSnackbar("파일 크기는 5MB 이하여야 합니다.", "warning");
        return;
      }

      // 파일 타입 체크
      if (!file.type.startsWith("image/")) {
        openSnackbar("이미지 파일만 업로드 가능합니다.", "warning");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setFormData((prev) => ({ ...prev, profileImage: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // TODO: 실제 회원가입 API 연동
      // OAuth에서 받은 정보 + 추가 정보를 서버로 전송
      // const response = await fetch(...);

      // 임시 처리
      localStorage.setItem("token", "mock");
      openSnackbar("회원가입이 완료되었습니다!", "success");

      setTimeout(() => {
        navigate("/", { replace: true });
      }, 1500);
    } catch (error) {
      openSnackbar("회원가입 중 오류가 발생했습니다.", "error");
      setIsSubmitting(false);
    }
  };

  const handleLogoClick = () => {
    navigate("/");
  };

  return (
    // 배경색
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      {/* 중앙 흰색 카드 */}
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full mx-4 max-w-sm md:max-w-md lg:max-w-lg">
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
            구글 계정 인증이 완료되었습니다. 추가 정보를 입력해주세요.
          </p>
        </div>

        {/* 프로필 이미지 */}
        <div className="mb-6">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <img
                src={formData.profileImage || userInfo.picture}
                alt="프로필"
                className="w-24 h-24 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                onClick={handleProfileImageClick}
              />
              <div className="absolute bottom-0 right-0 bg-violet-600 text-white rounded-full p-2 cursor-pointer hover:bg-violet-700 transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          <p className="text-xs text-gray-500 text-center">
            프로필 사진을 클릭하여 변경할 수 있습니다
          </p>
        </div>

        {/* 추가 정보 입력 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div>
            <label
              htmlFor="nickname"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              닉네임
            </label>
            <input
              id="nickname"
              name="nickname"
              type="text"
              value={formData.nickname}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="닉네임을 입력하세요"
            />
          </div>
          <div>
            <label
              htmlFor="birthDate"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              생년월일
            </label>
            <input
              id="birthDate"
              name="birthDate"
              type="date"
              value={formData.birthDate}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <Button
            type="submit"
            size="medium"
            fullWidth
            disabled={isSubmitting}
            className="h-12"
            sx={{
              backgroundColor: "#7C3AED",
              color: "#ffffff",
              textTransform: "none",
              "&:hover": { backgroundColor: "#6D28D9" },
              "&:disabled": { backgroundColor: "#D1D5DB", color: "#9CA3AF" },
            }}
          >
            <span className="text-sm font-medium">
              {isSubmitting ? "가입 중..." : "회원가입 완료"}
            </span>
          </Button>
        </form>

        {/* 로그인 링크 */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            이미 계정이 있으신가요?{" "}
            <button
              onClick={() => navigate("/auth/login")}
              className="text-violet-600 hover:text-violet-800 font-medium"
            >
              로그인
            </button>
          </p>
        </div>

        {/* 하단 저작권 정보 */}
        <div className="text-center text-xs text-gray-500 space-y-1 mt-6">
          <p>© 2025 Tickget, All Right reserved</p>
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
