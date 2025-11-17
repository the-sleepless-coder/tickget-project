import { Outlet } from "react-router-dom";
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
import { useWebSocketStore } from "../../shared/lib/websocket-store";
import { useAuthStore } from "../../features/auth/store";

export default function PlainLayout() {
  const isLoggedIn = !!useAuthStore((s) => s.accessToken);
  const setClient = useWebSocketStore((s) => s.setClient);
  const clientRef = useRef<StompClient | null>(null);
  const userSubscriptionRef = useRef<Subscription | null>(null);

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
          console.log("✅ [PlainLayout] 기존 WebSocket 연결 재사용");
        }
        clientRef.current = existingClient;

        // 개인 메시지 구독이 없으면 구독
        if (!userSubscriptionRef.current) {
          doSubscribeUserMessage(existingClient);
        }
      } else if (!clientRef.current) {
        // 기존 연결이 없거나 끊어진 경우에만 새로 생성
        if (import.meta.env.DEV) {
          console.log("🆕 [PlainLayout] 새 WebSocket 연결 생성");
        }
        const client = createStompClient({
          onConnect: () => {
            if (import.meta.env.DEV) {
              console.log("✅ [PlainLayout] WebSocket 연결 완료");
            }

            // 개인 메시지 구독: /user/{userId}
            doSubscribeUserMessage(client);
          },
          onDisconnect: () => {
            if (import.meta.env.DEV) {
              console.log("⚠️ [PlainLayout] WebSocket 연결 끊김");
            }
            // 구독 해제
            if (userSubscriptionRef.current) {
              userSubscriptionRef.current.unsubscribe();
              userSubscriptionRef.current = null;
            }
          },
          onError: (err) => {
            if (import.meta.env.DEV) {
              console.error("❌ [PlainLayout] WebSocket 에러:", err);
            }
            // 구독 해제
            if (userSubscriptionRef.current) {
              userSubscriptionRef.current.unsubscribe();
              userSubscriptionRef.current = null;
            }
          },
        });
        clientRef.current = client;
        setClient(client);
        connectStompClient(client);
      }
    }

    return () => {
      // PlainLayout 언마운트 시 개인 메시지 구독만 해제
      // WebSocket 클라이언트는 다른 컴포넌트(MainLayout, ExterparkRoom)에서도 사용 중일 수 있으므로 끊지 않음
      if (userSubscriptionRef.current) {
        if (import.meta.env.DEV) {
          console.log("🔌 [PlainLayout] 개인 메시지 구독 해제");
        }
        userSubscriptionRef.current.unsubscribe();
        userSubscriptionRef.current = null;
      }
      // clientRef는 초기화하지만 클라이언트 자체는 끊지 않음
      clientRef.current = null;
    };
  }, [isLoggedIn, setClient]);

  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  );
}
