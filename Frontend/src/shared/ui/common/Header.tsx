import { Link, useLocation, useNavigate } from "react-router-dom";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import { useAuthStore } from "@features/auth/store";
import { exitRoom } from "@features/room/api";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const isITicket = location.pathname.startsWith("/i-ticket");
  const nickname = useAuthStore((state) => state.nickname);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isLoggedIn = !!accessToken;

  const resolveRoomIdFromLocation = (): number | undefined => {
    // 1) /i-ticket/:roomId 패턴
    const match = location.pathname.match(/^\/i-ticket\/(\d+)/);
    if (match && match[1] && !Number.isNaN(Number(match[1]))) {
      return Number(match[1]);
    }
    // 2) ?roomId= 쿼리
    const qsRoomId = new URLSearchParams(location.search).get("roomId");
    if (qsRoomId && !Number.isNaN(Number(qsRoomId))) {
      return Number(qsRoomId);
    }
    return undefined;
  };

  const confirmAndExitIfInRoom = async (): Promise<boolean> => {
    const isInRoom = location.pathname.startsWith("/i-ticket");
    if (!isInRoom) return true;

    const ok = confirm("정말 방을 나가시겠습니까?");
    if (!ok) return false;

    try {
      const roomId = resolveRoomIdFromLocation();
      const { userId, nickname: currentNickname } = useAuthStore.getState();
      if (roomId && userId && currentNickname) {
        await exitRoom(roomId, { userId, userName: currentNickname });
      }
    } catch (e) {
      // 실패해도 내비게이션/로그아웃은 진행
      if (import.meta.env.DEV) {
        console.error("방 나가기 중 오류:", e);
      }
    }
    return true;
  };

  const handleHomeClick: React.MouseEventHandler<HTMLAnchorElement> = async (
    e
  ) => {
    const proceed = await confirmAndExitIfInRoom();
    if (!proceed) {
      e.preventDefault();
      return;
    }
    // Link 기본 동작으로 이동
  };

  const handleMyPageClick: React.MouseEventHandler<HTMLAnchorElement> = async (
    e
  ) => {
    const proceed = await confirmAndExitIfInRoom();
    if (!proceed) {
      e.preventDefault();
      return;
    }
  };

  const handleLogout = async () => {
    const proceed = await confirmAndExitIfInRoom();
    if (!proceed) return;
    useAuthStore.getState().clearAuth();
    navigate("/", { replace: true });
  };

  return (
    <header className="border-b border-neutral-200">
      <div className="w-full px-5 py-3">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-3"
            onClick={handleHomeClick}
          >
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
              <Link
                to="/mypage"
                aria-label="프로필"
                onClick={handleMyPageClick}
              >
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
              <Link
                to="/mypage"
                aria-label="프로필"
                onClick={handleMyPageClick}
              >
                <AccountCircleOutlinedIcon className="text-purple-500" />
              </Link>
            )}
            {isLoggedIn && nickname && (
              <Link
                to="/mypage"
                onClick={handleMyPageClick}
                className="text-sm text-neutral-700 hover:text-neutral-900"
              >
                {nickname}
              </Link>
            )}
            {isLoggedIn ? (
              <button
                onClick={handleLogout}
                className="text-sm text-neutral-700 hover:text-neutral-900"
              >
                로그아웃
              </button>
            ) : (
              <Link
                to="/auth/login"
                className="text-sm text-neutral-700 hover:text-neutral-900"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
