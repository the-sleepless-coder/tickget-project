import { Link, useLocation, useNavigate } from "react-router-dom";
import GoogleSignInButton from "../../../features/auth/google-signin/ui/GoogleSignInButton";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || "/";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: 실제 로그인 API 연동
    localStorage.setItem("token", "mock");
    navigate(from, { replace: true });
  };

  const handleGoogle = () => {
    // TODO: 실제 Google OAuth 연동
    localStorage.setItem("token", "mock");
    navigate(from, { replace: true });
  };

  return (
    <>
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-900">
        로그인
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="이메일을 입력하세요"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="비밀번호를 입력하세요"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          로그인
        </button>
      </form>
      <div className="mt-4">
        <GoogleSignInButton onClick={handleGoogle} />
      </div>
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          계정이 없으신가요?{" "}
          <Link
            to="/auth/signup"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            회원가입
          </Link>
        </p>
      </div>
    </>
  );
}
