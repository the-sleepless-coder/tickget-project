import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RoomInfo {
  roomId: number | null;
  roomName: string | null;
  thumbnailValue: string | null;
  thumbnailType: string | null;
  hallId: number | null;
  hallName: string | null;
  startTime: string | null;
  captchaPassed: boolean;
  totalSeat: number | null;
  tsxUrl: string | null;
}

interface RoomState {
  roomInfo: RoomInfo;
  setRoomInfo: (info: Partial<RoomInfo>) => void;
  clearRoomInfo: () => void;
  setCaptchaPassed: (passed: boolean) => void;
}

const initialRoomInfo: RoomInfo = {
  roomId: null,
  roomName: null,
  thumbnailValue: null,
  thumbnailType: null,
  hallId: null,
  hallName: null,
  startTime: null,
  captchaPassed: false,
  totalSeat: null,
  tsxUrl: null,
};

export const useRoomStore = create<RoomState>()(
  persist(
    (set) => ({
      roomInfo: initialRoomInfo,
      setRoomInfo: (info) => {
        set((state) => ({
          roomInfo: {
            ...state.roomInfo,
            ...info,
          },
        }));
        if (import.meta.env.DEV) {
          console.log("[RoomStore] 방 정보 업데이트:", info);
        }
      },
      clearRoomInfo: () => {
        set({ roomInfo: initialRoomInfo });
        if (import.meta.env.DEV) {
          console.log("[RoomStore] 방 정보 초기화");
        }
      },
      setCaptchaPassed: (passed) => {
        set((state) => ({
          roomInfo: {
            ...state.roomInfo,
            captchaPassed: passed,
          },
        }));
        if (import.meta.env.DEV) {
          console.log("[RoomStore] 캡챠 통과 상태 업데이트:", passed);
        }
      },
    }),
    {
      name: "room-storage",
    }
  )
);

// 개발 편의를 위한 글로벌 접근 (dev 전용)
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as Window & { roomStore?: typeof useRoomStore }).roomStore =
    useRoomStore;
}
