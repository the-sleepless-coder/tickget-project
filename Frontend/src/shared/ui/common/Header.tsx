import { Link, useLocation } from "react-router-dom";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";

export default function Header() {
  const location = useLocation();
  const isITicket = location.pathname.startsWith("/i-ticket");
  return (
    <header className="border-b border-neutral-200">
      <div className="w-full px-5 py-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={
                isITicket ? "/header-logo-blue.svg" : "/header-logo-violet.svg"
              }
              alt="Tickget"
              className="h-7 w-auto"
            />
          </Link>

          <div className="flex items-center gap-3">
            {isITicket ? (
              <Link to="/mypage" aria-label="프로필">
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full"
                  style={
                    {
                      // backgroundColor: "var(--color-c-blue-100)",
                    }
                  }
                >
                  <AccountCircleOutlinedIcon
                    style={{ color: "var(--color-c-blue-200)" }}
                  />
                </span>
              </Link>
            ) : (
              <Link to="/mypage" aria-label="프로필">
                <AccountCircleOutlinedIcon className="text-purple-500" />
              </Link>
            )}
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
              로그아웃
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
