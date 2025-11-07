import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 2;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nickname: "",
    birthDate: "",
    profileImage: "",
    gender: "",
    name: "",
    address: "",
    phoneNumber: "",
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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNext = () => {
    // Step 1 검증: 닉네임과 생년월일은 필수
    if (currentStep === 1) {
      if (!formData.nickname.trim() || !formData.birthDate) {
        openSnackbar("닉네임과 생년월일을 입력해주세요.", "warning");
        return;
      }
    }
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (
    e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>
  ) => {
    if (e) e.preventDefault();
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
    } catch {
      openSnackbar("회원가입 중 오류가 발생했습니다.", "error");
      setIsSubmitting(false);
    }
  };

  const handleLogoClick = () => {
    navigate("/");
  };

  return (
    // 전체 컨테이너
    <div
      className="fixed inset-0 flex flex-col"
      style={{ backgroundColor: "#E9EBF4" }}
    >
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
        {/* 중앙 카드 영역 */}
        <div className="relative z-10 flex items-center justify-center w-full px-4 md:px-8 lg:px-12">
          {/* 중앙 흰색 카드 */}
          <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm md:max-w-md lg:max-w-xl">
            {/* 로고와 제목 */}
            <div className="text-center mb-6">
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
              <p className="text-gray-600 text-sm mb-4">
                구글 계정 인증이 완료되었습니다. 추가 정보를 입력해주세요.
              </p>

              {/* 단계 표시 */}
              <div className="flex items-center justify-center gap-2 mb-2">
                {[1, 2].map((step) => (
                  <div key={step} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        step === currentStep
                          ? "bg-violet-600 text-white"
                          : step < currentStep
                            ? "bg-violet-300 text-white"
                            : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {step}
                    </div>
                    {step < totalSteps && (
                      <div
                        className={`w-12 h-0.5 mx-1 ${
                          step < currentStep ? "bg-violet-300" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                {currentStep === 1 ? "기본 정보" : "추가 정보"}
              </p>
            </div>

            {/* 단계별 컨텐츠 */}
            <div className="mb-6">
              {/* Step 1: 기본 정보 */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  {/* 프로필 이미지 */}
                  <div>
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

                  <div className="flex gap-4">
                    <div className="flex-1">
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
                    <div className="w-32">
                      <label
                        htmlFor="gender"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        성별{" "}
                        <span className="text-gray-400 text-xs">(선택)</span>
                      </label>
                      <select
                        id="gender"
                        name="gender"
                        value={formData.gender}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      >
                        <option value="">선택</option>
                        <option value="male">남성</option>
                        <option value="female">여성</option>
                      </select>
                    </div>
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
                </div>
              )}

              {/* Step 2: 추가 정보 */}
              {currentStep === 2 && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      이름{" "}
                      <span className="text-gray-400 text-xs">(선택사항)</span>
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      placeholder="이름을 입력하세요"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="address"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      주소{" "}
                      <span className="text-gray-400 text-xs">(선택사항)</span>
                    </label>
                    <input
                      id="address"
                      name="address"
                      type="text"
                      value={formData.address}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      placeholder="주소를 입력하세요"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="phoneNumber"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      전화번호{" "}
                      <span className="text-gray-400 text-xs">(선택사항)</span>
                    </label>
                    <input
                      id="phoneNumber"
                      name="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      placeholder="전화번호를 입력하세요"
                    />
                  </div>
                </form>
              )}
            </div>

            {/* 네비게이션 버튼 */}
            <div className="flex gap-3 mb-6">
              {currentStep > 1 && (
                <Button
                  onClick={handlePrev}
                  size="medium"
                  fullWidth
                  className="h-12"
                  sx={{
                    backgroundColor: "#F3F4F6",
                    color: "#6B7280",
                    textTransform: "none",
                    "&:hover": { backgroundColor: "#E5E7EB" },
                  }}
                >
                  <span className="text-sm font-medium">이전</span>
                </Button>
              )}
              {currentStep < totalSteps ? (
                <Button
                  onClick={handleNext}
                  size="medium"
                  fullWidth
                  className="h-12"
                  sx={{
                    backgroundColor: "#7C3AED",
                    color: "#ffffff",
                    textTransform: "none",
                    "&:hover": { backgroundColor: "#6D28D9" },
                  }}
                >
                  <span className="text-sm font-medium">다음</span>
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  size="medium"
                  fullWidth
                  disabled={isSubmitting}
                  className="h-12"
                  sx={{
                    backgroundColor: "#7C3AED",
                    color: "#ffffff",
                    textTransform: "none",
                    "&:hover": { backgroundColor: "#6D28D9" },
                    "&:disabled": {
                      backgroundColor: "#D1D5DB",
                      color: "#9CA3AF",
                    },
                  }}
                >
                  <span className="text-sm font-medium">
                    {isSubmitting ? "가입 중..." : "회원가입 완료"}
                  </span>
                </Button>
              )}
            </div>

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
