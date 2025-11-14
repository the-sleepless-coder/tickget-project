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
        if (import.meta.env.DEV) {
          console.log("ℹ️ [개인 메시지] 이미 구독되어 있음");
        }
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

    if (isLoggedIn && !clientRef.current) {
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
    } else if (isLoggedIn) {
      // 웹소켓이 이미 연결되어 있는 경우 (방 입장 후 나와서 다시 전체 방 목록인 경우)
      const existingClient = useWebSocketStore.getState().client;
      if (
        existingClient &&
        existingClient.connected &&
        !userSubscriptionRef.current
      ) {
        if (import.meta.env.DEV) {
          console.log("✅ [개인 메시지] 기존 연결에서 구독 시도");
        }
        doSubscribeUserMessage(existingClient);
      }
    }

    return () => {
      if (clientRef.current) {
        // 구독 해제
        if (userSubscriptionRef.current) {
          userSubscriptionRef.current.unsubscribe();
          userSubscriptionRef.current = null;
        }
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
