import { Outlet, useNavigate } from "react-router-dom";
import Header from "../../shared/ui/common/Header";
import Footer from "../../shared/ui/common/Footer";
import ScrollToTop from "../routes/ScrollToTop";
import { useEffect, useRef } from "react";
import {
  createStompClient,
  connectStompClient,
  disconnectStompClient,
  subscribe,
  type StompClient,
  type Subscription,
} from "../../shared/lib/websocket";
import { useAuthStore } from "../../features/auth/store";
import { useWebSocketStore } from "../../shared/lib/websocket-store";

export default function MainLayout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isLoggedIn = !!accessToken;
  const clientRef = useRef<StompClient | null>(null);
  const userSubscriptionRef = useRef<Subscription | null>(null);
  const setClient = useWebSocketStore((s) => s.setClient);
  const navigate = useNavigate();

  useEffect(() => {
    const userId = useAuthStore.getState().userId;

    // 개인 메시지 구독 로직을 함수로 분리
    const doSubscribeUserMessage = (client: StompClient) => {
      if (userId == null) return;

      // 이미 구독되어 있으면 스킵
      if (userSubscriptionRef.current) {
        return;
      }

      const userDestination = `/user/${userId}`;
      const subscription = subscribe(client, userDestination, (message) => {
        try {
          const event = JSON.parse(message.body);
          if (import.meta.env.DEV) {
            console.log("📨 [개인 메시지] 수신:", {
              destination: message.headers.destination,
              eventType: event.eventType,
              body: event,
            });
          }

          // 결과 페이지에서는 USER_LEFT 이벤트 무시
          const currentPath = window.location.pathname;
          const isGameResultPage = currentPath.includes("/game-result");

          if (
            isGameResultPage &&
            (event.eventType === "USER_LEFT" ||
              event.eventType === "USER_EXITED")
          ) {
            if (import.meta.env.DEV) {
              console.log(
                "ℹ️ [개인 메시지] 결과 페이지에서 USER_LEFT 이벤트 무시:",
                event
              );
            }
            return; // 결과 페이지에서는 퇴장 알림 무시
          }

          if (event.eventType === "FORCE_DISCONNECT") {
            const payload = event.payload as
              | {
                  reason?: string;
                  message?: string;
                  timestamp?: number;
                }
              | undefined;
            const disconnectMessage =
              payload?.message ||
              event.message ||
              "다른 기기에서 로그인되어 연결이 종료됩니다.";

            if (import.meta.env.DEV) {
              console.warn("🚨 [FORCE_DISCONNECT] 강제 연결 종료:", {
                reason: payload?.reason,
                message: disconnectMessage,
                timestamp: payload?.timestamp || event.timestamp,
              });
            }

            // 사용자에게 알림
            alert(disconnectMessage);

            // 즉시 연결 종료
            disconnectStompClient(client);
            useAuthStore.getState().clearAuth();
            navigate("/", { replace: true });
          }
        } catch (e) {
          console.error("❌ [개인 메시지] 파싱 실패:", e, message.body);
        }
      });

      if (subscription) {
        userSubscriptionRef.current = subscription;
        if (import.meta.env.DEV) {
          console.log(`✅ [개인 메시지] 구독 성공: ${userDestination}`);
        }
      } else {
        console.warn("⚠️ [개인 메시지] 구독 실패");
      }
    };

    if (isLoggedIn) {
      // 먼저 기존 웹소켓 클라이언트 확인 (store에서)
      const existingClient = useWebSocketStore.getState().client;

      if (existingClient && existingClient.connected) {
        // 기존 연결이 있고 연결되어 있으면 재사용
        if (import.meta.env.DEV) {
          console.log("✅ [MainLayout] 기존 WebSocket 연결 재사용");
        }
        clientRef.current = existingClient;

        // 개인 메시지 구독이 없으면 구독
        if (!userSubscriptionRef.current) {
          if (import.meta.env.DEV) {
            console.log("✅ [개인 메시지] 기존 연결에서 구독 시도");
          }
          doSubscribeUserMessage(existingClient);
        }
      } else if (!clientRef.current) {
        // 기존 연결이 없거나 끊어진 경우에만 새로 생성
        if (import.meta.env.DEV) {
          console.log("🆕 [MainLayout] 새 WebSocket 연결 생성");
        }
        const client = createStompClient({
          onConnect: () => {
            if (import.meta.env.DEV) {
              console.log("✅ 홈 진입: WebSocket 연결 완료");
            }

            // 개인 메시지 구독: /user/{userId}
            doSubscribeUserMessage(client);
          },
          onDisconnect: () => {
            if (import.meta.env.DEV) {
              console.log("⚠️ WebSocket 연결 끊김");
            }
            // 구독 해제
            if (userSubscriptionRef.current) {
              userSubscriptionRef.current.unsubscribe();
              userSubscriptionRef.current = null;
            }
            // 이미 로그아웃 상태면 자동 로그아웃을 하지 않음 (의도적인 로그아웃인 경우)
            const currentAccessToken = useAuthStore.getState().accessToken;
            if (currentAccessToken) {
              // 로그인 상태인데 연결이 끊긴 경우에만 자동 로그아웃
              if (import.meta.env.DEV) {
                console.log("⚠️ WebSocket 연결 끊김 - 자동 로그아웃");
              }
              useAuthStore.getState().clearAuth();
              navigate("/", { replace: true });
            } else {
            }
          },
          onError: (err) => {
            if (import.meta.env.DEV) {
              console.error("❌ WebSocket 에러:", err);
            }
            // 구독 해제
            if (userSubscriptionRef.current) {
              userSubscriptionRef.current.unsubscribe();
              userSubscriptionRef.current = null;
            }
            // 이미 로그아웃 상태면 자동 로그아웃을 하지 않음
            const currentAccessToken = useAuthStore.getState().accessToken;
            if (currentAccessToken) {
              // 로그인 상태인데 에러가 발생한 경우에만 자동 로그아웃
              useAuthStore.getState().clearAuth();
              navigate("/", { replace: true });
            }
          },
        });
        clientRef.current = client;
        setClient(client); // store에 저장
        connectStompClient(client);
      }
    }

    return () => {
      // 로그아웃하거나 레이아웃 언마운트 시 정리
      if (!isLoggedIn && clientRef.current) {
        // 구독 해제
        if (userSubscriptionRef.current) {
          userSubscriptionRef.current.unsubscribe();
          userSubscriptionRef.current = null;
        }
        disconnectStompClient(clientRef.current);
        setClient(null); // store에서 제거
        clientRef.current = null;
      }
    };
  }, [isLoggedIn, setClient, navigate]);

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
