import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@features/auth/store";
import { exitRoom } from "@features/room/api";
import { normalizeProfileImageUrl } from "@shared/utils/profileImageUrl";
import { useWebSocketStore } from "@shared/lib/websocket-store";
import { disconnectStompClient } from "@shared/lib/websocket";
import HeaderShortcuts from "./HeaderShortcuts";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const isITicket = location.pathname.startsWith("/i-ticket");
  const nickname = useAuthStore((state) => state.nickname);
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.userId);
  const rawProfileImageUrl = useAuthStore((state) => state.profileImageUrl);
  const profileImageUploaded = useAuthStore(
    (state) => state.profileImageUploaded
  );
  // rawProfileImageUrl이 없어도 userId로 S3 경로 생성
  // 타임스탬프 없이 원래 경로 그대로 사용
  const baseProfileImageUrl = normalizeProfileImageUrl(
    rawProfileImageUrl || null,
    userId,
    false // 타임스탬프 추가하지 않음
  );

  // profileImageUploaded가 변경되면 src에 _refresh 쿼리 파라미터를 추가하여 브라우저 캐시 무효화
  // 타임스탬프가 아닌 _refresh 파라미터를 사용하여 원래 경로는 유지하되 캐시만 무효화
  const profileImageUrl =
    baseProfileImageUrl && profileImageUploaded > 0
      ? `${baseProfileImageUrl}${baseProfileImageUrl.includes("?") ? "&" : "?"}_refresh=${profileImageUploaded}`
      : baseProfileImageUrl;

  // 마이페이지와 동일하게 URL을 key로 사용
  // profileImageUrl이 변경되면 (profileImageUploaded가 변경되면 _refresh 파라미터가 추가됨) key도 변경
  const imageKey = profileImageUrl || `default-${profileImageUploaded}`;
  const isLoggedIn = !!accessToken;
  const [imageError, setImageError] = useState(false);

  // 프로필 이미지 URL이 변경되면 에러 상태 리셋
  useEffect(() => {
    setImageError(false);
  }, [rawProfileImageUrl, profileImageUploaded]);

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

  const handleHomeClick: React.MouseEventHandler<HTMLButtonElement> = async (
    e
  ) => {
    // 기본 네비게이션을 먼저 막고, 선택에 따라 이동
    e.preventDefault();
    const proceed = await confirmAndExitIfInRoom();
    if (proceed) {
      navigate("/", { replace: true });
    }
  };

  const handleMyPageClick: React.MouseEventHandler<HTMLButtonElement> = async (
    e
  ) => {
    e.preventDefault();
    const proceed = await confirmAndExitIfInRoom();
    if (proceed) {
      navigate("/mypage");
    }
  };

  const handleLogout = async () => {
    const proceed = await confirmAndExitIfInRoom();
    if (!proceed) return;

    // WebSocket 연결을 먼저 정리
    const wsClient = useWebSocketStore.getState().client;
    if (wsClient) {
      disconnectStompClient(wsClient);
      useWebSocketStore.getState().setClient(null);
    }

    // 인증 상태 초기화
    useAuthStore.getState().clearAuth();
    // 상태 업데이트가 완료되도록 다음 이벤트 루프까지 대기
    await new Promise((resolve) => setTimeout(resolve, 0));
    navigate("/", { replace: true });
  };

  const handleLoginClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 현재 상태를 직접 확인하여 로그아웃 상태라면 무조건 로그인 페이지로 이동
    const currentAccessToken = useAuthStore.getState().accessToken;
    if (!currentAccessToken) {
      navigate("/auth/login", { replace: false });
    }
  };

  return (
    <header className="mt-1">
      <div className="w-full px-5 py-3">
        <div className="flex items-center justify-between">
          {/* Left: 로고 */}
          <div className="flex items-center">
            <button
              type="button"
              className="flex items-center gap-3 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 rounded cursor-pointer"
              onClick={handleHomeClick}
              aria-label="홈"
            >
              <img
                src={
                  isITicket
                    ? "/header-logo-blue.svg"
                    : "/header-logo-violet.svg"
                }
                alt="Tickget"
                className="h-7 w-auto ml-2"
              />
            </button>
          </div>

          {/* Center: 상단 바로가기 */}
          <div className="flex-1 flex justify-center">
            <HeaderShortcuts />
          </div>

          {/* Right: 프로필 / 로그인 */}
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                {isITicket ? (
                  <button
                    type="button"
                    aria-label="프로필"
                    onClick={handleMyPageClick}
                    className="cursor-pointer"
                  >
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full overflow-hidden"
                      style={
                        {
                          // backgroundColor: "var(--color-c-blue-100)",
                        }
                      }
                    >
                      {profileImageUrl && !imageError ? (
                        <img
                          key={imageKey}
                          src={profileImageUrl}
                          alt="프로필"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // profile.png로 대체
                            const target = e.target as HTMLImageElement;
                            if (target.src !== "/profile.png") {
                              target.src = "/profile.png";
                            } else {
                              setImageError(true);
                            }
                          }}
                        />
                      ) : (
                        <img
                          src="/profile.png"
                          alt="프로필"
                          className="w-full h-full object-cover"
                          onError={() => {
                            setImageError(true);
                          }}
                        />
                      )}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="프로필"
                    onClick={handleMyPageClick}
                    className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center cursor-pointer"
                  >
                    {profileImageUrl && !imageError ? (
                      <img
                        key={imageKey}
                        src={profileImageUrl}
                        alt="프로필"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // profile.png로 대체
                          const target = e.target as HTMLImageElement;
                          if (target.src !== "/profile.png") {
                            target.src = "/profile.png";
                          } else {
                            setImageError(true);
                          }
                        }}
                      />
                    ) : (
                      <img
                        src="/profile.png"
                        alt="프로필"
                        className="w-full h-full object-cover"
                        onError={() => {
                          setImageError(true);
                        }}
                      />
                    )}
                  </button>
                )}
                {nickname && (
                  <button
                    type="button"
                    onClick={handleMyPageClick}
                    className="text-md text-neutral-700 hover:text-neutral-900 cursor-pointer mr-3"
                    aria-label="마이페이지"
                  >
                    {nickname}
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  className="mr-4 text-md font-bold text-neutral-700 hover:text-neutral-900 font-bold cursor-pointer"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleLoginClick}
                className="text-md font-bold text-neutral-700 hover:text-neutral-900 mr-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 rounded px-1 cursor-pointer"
                style={{ display: "block" }}
              >
                로그인
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
