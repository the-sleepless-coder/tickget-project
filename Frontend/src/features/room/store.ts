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
       
      },
      clearRoomInfo: () => {
        set({ roomInfo: initialRoomInfo });
       
      },
      setCaptchaPassed: (passed) => {
        set((state) => ({
          roomInfo: {
            ...state.roomInfo,
            captchaPassed: passed,
          },
        }));
       
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
