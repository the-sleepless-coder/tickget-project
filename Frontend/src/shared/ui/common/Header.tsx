import { Link } from "react-router-dom";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";

export default function Header() {
  return (
    <header className="border-b border-neutral-200">
      <div className="w-full px-5 py-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/header-logo.svg" alt="Tickget" className="h-7 w-auto" />
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/mypage" aria-label="프로필">
              <AccountCircleOutlinedIcon className="text-purple-500" />
            </Link>
            <Link
              to="/mypage"
              className="hidden sm:inline text-sm text-neutral-700 hover:text-neutral-900"
            >
              닉네임
            </Link>
            <Link
              to="/auth/login"
              className="text-sm text-neutral-700 hover:text-neutral-900"
            >
              로그인
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
