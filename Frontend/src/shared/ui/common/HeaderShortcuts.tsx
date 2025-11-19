import { useLocation, useNavigate } from "react-router-dom";
import { exitRoom } from "@features/room/api";
import { useAuthStore } from "@features/auth/store";
import { paths } from "../../../app/routes/paths";
import { showConfirm } from "../../utils/confirm";

function useConfirmExitRoom() {
  const location = useLocation();

  const resolveRoomIdFromLocation = (): number | undefined => {
    const match = location.pathname.match(/^\/i-ticket\/(\d+)/);
    if (match && match[1] && !Number.isNaN(Number(match[1]))) {
      return Number(match[1]);
    }
    const qsRoomId = new URLSearchParams(location.search).get("roomId");
    if (qsRoomId && !Number.isNaN(Number(qsRoomId))) {
      return Number(qsRoomId);
    }
    return undefined;
  };

  const confirmAndExitIfInRoom = async (): Promise<boolean> => {
    const isInRoom = location.pathname.startsWith("/i-ticket");
    if (!isInRoom) return true;

    const ok = await showConfirm(
      "정말 방을 나가시겠습니까?\n취소하면 현재 화면을 유지합니다.",
      {
        confirmText: "방 나가기",
        cancelText: "취소",
        type: "warning",
      }
    );
    if (!ok) return false;

    try {
      const roomId = resolveRoomIdFromLocation();
      const { userId, nickname } = useAuthStore.getState();
      if (roomId && userId && nickname) {
        await exitRoom(roomId, { userId, userName: nickname });
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error("방 나가기 중 오류:", e);
      }
    }
    return true;
  };

  return confirmAndExitIfInRoom;
}

export default function HeaderShortcuts() {
  const location = useLocation();
  const navigate = useNavigate();
  const confirmAndExitIfInRoom = useConfirmExitRoom();

  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.userId);
  const nickname = useAuthStore((state) => state.nickname);

  // 주 경로 매칭
  const isRoomsPage = location.pathname === paths.rooms;
  const isWeeklyRankingPage = location.pathname === paths.weeklyRanking;
  const isMyPage = location.pathname.startsWith(paths.mypage.root);

  const baseItemClass =
    "relative px-3 py-2 text-sm md:text-base font-extrabold text-black border-b-[2.5px] cursor-pointer transition-colors";
  const activeClass = "border-c-fuchsia-300";
  const inactiveClass = "border-transparent";

  const handleGoRooms = async () => {
    const proceed = await confirmAndExitIfInRoom();
    if (!proceed) return;
    navigate(paths.rooms);
  };

  const handleGoWeeklyRanking = async () => {
    const proceed = await confirmAndExitIfInRoom();
    if (!proceed) return;

    // 로그인 여부 체크 (주간 랭킹은 로그인 유저만 접근)
    if (!userId || !nickname || !accessToken) {
      const shouldLogin = await showConfirm(
        "로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?",
        {
          confirmText: "로그인",
          cancelText: "취소",
          type: "info",
        }
      );
      if (shouldLogin) {
        navigate(paths.auth.login);
      }
      return;
    }

    navigate(paths.weeklyRanking);
  };

  const handleGoMyPage = async () => {
    const proceed = await confirmAndExitIfInRoom();
    if (!proceed) return;
    navigate(paths.mypage.root);
  };

  // i-ticket 내부에서는 상단 바로가기 숨김
  const isITicket = location.pathname.startsWith("/i-ticket");
  if (isITicket) return null;

  return (
    <nav className="hidden md:flex items-center gap-4 lg:gap-8">
      <button
        type="button"
        onClick={handleGoRooms}
        className={`${baseItemClass} ${isRoomsPage ? activeClass : inactiveClass}`}
      >
        방목록
      </button>
      {/* <button
        type="button"
        onClick={handleCreateRoom}
        className={`${baseItemClass} ${inactiveClass}`}
      >
        새로운방
      </button> */}
      <button
        type="button"
        onClick={handleGoWeeklyRanking}
        className={`${baseItemClass} ${
          isWeeklyRankingPage ? activeClass : inactiveClass
        }`}
      >
        주간랭킹
      </button>
      <button
        type="button"
        onClick={handleGoMyPage}
        className={`${baseItemClass} ${isMyPage ? activeClass : inactiveClass}`}
      >
        마이페이지
      </button>
    </nav>
  );
}
