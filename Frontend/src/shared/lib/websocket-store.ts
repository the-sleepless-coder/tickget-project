import { create } from "zustand";
import type { StompClient } from "./websocket";

interface WebSocketState {
  client: StompClient | null;
  setClient: (client: StompClient | null) => void;
}

export const useWebSocketStore = create<WebSocketState>((set) => ({
  client: null,
  setClient: (client) => set({ client }),
}));

