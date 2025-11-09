import { Outlet } from "react-router-dom";
import Header from "../../shared/ui/common/Header";
import Footer from "../../shared/ui/common/Footer";
import ScrollToTop from "../routes/ScrollToTop";
import { useEffect, useRef } from "react";
import {
  createStompClient,
  connectStompClient,
  disconnectStompClient,
  type StompClient,
} from "../../shared/lib/websocket";
import { useAuthStore } from "../../features/auth/store";
import { useWebSocketStore } from "../../shared/lib/websocket-store";

export default function MainLayout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isLoggedIn = !!accessToken;
  const clientRef = useRef<StompClient | null>(null);
  const setClient = useWebSocketStore((s) => s.setClient);

  useEffect(() => {
    if (isLoggedIn && !clientRef.current) {
      const client = createStompClient({
        onConnect: () => {
          if (import.meta.env.DEV) {
            console.log("✅ 홈 진입: WebSocket 연결 완료");
          }
        },
        onError: (err) => {
          if (import.meta.env.DEV) {
            console.error("❌ WebSocket 에러:", err);
          }
        },
      });
      clientRef.current = client;
      setClient(client); // store에 저장
      connectStompClient(client);
    }

    return () => {
      // 로그아웃하거나 레이아웃 언마운트 시 정리
      if (!isLoggedIn && clientRef.current) {
        disconnectStompClient(clientRef.current);
        setClient(null); // store에서 제거
        clientRef.current = null;
      }
    };
  }, [isLoggedIn, setClient]);

  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      <Header />

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
