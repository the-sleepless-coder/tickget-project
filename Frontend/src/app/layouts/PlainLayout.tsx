import { Outlet } from "react-router-dom";
import ScrollToTop from "../routes/ScrollToTop";
import { useEffect, useRef } from "react";
import {
  createStompClient,
  connectStompClient,
  disconnectStompClient,
  type StompClient,
} from "../../shared/lib/websocket";
import { useWebSocketStore } from "../../shared/lib/websocket-store";
import { useAuthStore } from "../../features/auth/store";

export default function PlainLayout() {
  const isLoggedIn = !!useAuthStore((s) => s.accessToken);
  const setClient = useWebSocketStore((s) => s.setClient);
  const clientRef = useRef<StompClient | null>(null);

  useEffect(() => {
    if (isLoggedIn && !clientRef.current) {
      const client = createStompClient({
        onConnect: () => {
          if (import.meta.env.DEV) {
            console.log("✅ [PlainLayout] WebSocket 연결 완료");
          }
        },
        onDisconnect: () => {
          if (import.meta.env.DEV) {
            console.log("⚠️ [PlainLayout] WebSocket 연결 끊김");
          }
        },
        onError: (err) => {
          if (import.meta.env.DEV) {
            console.error("❌ [PlainLayout] WebSocket 에러:", err);
          }
        },
      });
      clientRef.current = client;
      setClient(client);
      connectStompClient(client);
    }

    return () => {
      if (clientRef.current) {
        disconnectStompClient(clientRef.current);
        setClient(null);
        clientRef.current = null;
      }
    };
  }, [isLoggedIn, setClient]);

  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  );
}
